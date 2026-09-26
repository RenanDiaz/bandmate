/**
 * Playback engine behind BackingTrackPlayer: one audio element routed through
 * a Web Audio graph (source → splitter → [gainL, gainR] → merger → master →
 * destination) so the L (track) and R (click/cues) channels have their own
 * volume. Plain TypeScript with injected factories so it is unit-tested
 * without a browser.
 *
 * Two problems it exists to solve:
 *
 * 1. **Stale audio on restart.** A MediaElementAudioSourceNode keeps a buffer
 *    of samples from before a stop/seek and plays them on the next play (a
 *    blip of the old position). Muting the output for a fixed time is not
 *    enough (the blip outlasts it on iOS), so a restart from another position
 *    while paused (stop, seek, end of track) uses a **fresh element and source
 *    node**, which have no buffer. A seek while playing only mutes briefly.
 *
 * 2. **Silent stall on iOS.** The element reports "playing" but its time does
 *    not move when its AudioContext is not running (suspended, "interrupted",
 *    closed). After each play a watchdog checks that the time advanced and the
 *    context runs; if not, it pauses, reports `onStalled`, and the next play
 *    (a user gesture, which iOS needs) rebuilds the context and the element.
 *    Never pretend to play.
 */

export const STALL_TIMEOUT_MS = 1500;
/** Minimum progress (s) of the element's time for a play to count as started. */
export const STALL_MIN_PROGRESS_S = 0.05;
/** Output mute after a seek while playing. */
export const SEEK_MUTE_S = 0.2;

export interface BackingTrackEngineListener {
  onTimeUpdate(time: number): void;
  onDurationChange(duration: number): void;
  onPlayingChange(playing: boolean): void;
  /** A play did not start (or playback stopped because the audio output died). */
  onStalled(): void;
}

export interface BackingTrackEngineDeps {
  createAudio(url: string): HTMLAudioElement;
  /** null when Web Audio is unavailable: the element then plays directly. */
  createContext(): AudioContext | null;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface ChannelVolumes {
  l: number;
  r: number;
}

interface Graph {
  ctx: AudioContext;
  splitter: ChannelSplitterNode;
  gainL: GainNode;
  gainR: GainNode;
  master: GainNode;
}

function defaultDeps(): BackingTrackEngineDeps {
  return {
    createAudio: (url) => {
      const audio = new Audio(url);
      audio.preload = "auto";
      return audio;
    },
    createContext: () => {
      type WebkitWindow = typeof window & { webkitAudioContext?: typeof AudioContext };
      const Ctor = window.AudioContext || (window as WebkitWindow).webkitAudioContext;
      return Ctor ? new Ctor() : null;
    },
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (handle) => window.clearTimeout(handle as number),
  };
}

export class BackingTrackEngine {
  private readonly deps: BackingTrackEngineDeps;
  private readonly listener: BackingTrackEngineListener;
  private url: string | null = null;
  private audio: HTMLAudioElement | null = null;
  private detachAudio: (() => void) | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private graph: Graph | null = null;
  private volumes: ChannelVolumes = { l: 1, r: 1 };
  /** Where a fresh element starts. */
  private position = 0;
  /** The current element must not be reused for the next play (stale buffer). */
  private freshElementNeeded = false;
  /** The audio output failed: the next play rebuilds the context too. */
  private rebuildNeeded = false;
  private stallTimer: unknown = null;
  private disposed = false;

  constructor(listener: BackingTrackEngineListener, deps: BackingTrackEngineDeps = defaultDeps()) {
    this.listener = listener;
    this.deps = deps;
  }

  get isPlaying(): boolean {
    return !!this.audio && !this.audio.paused;
  }

  /** Loads a track (null unloads). Stops what was playing. */
  setSource(url: string | null): void {
    if (this.disposed || url === this.url) return;
    this.clearStallWatch();
    this.releaseElement();
    this.url = url;
    this.position = 0;
    this.freshElementNeeded = false;
    this.listener.onTimeUpdate(0);
    this.listener.onDurationChange(0);
    this.listener.onPlayingChange(false);
    // An element right away (not connected yet) so the duration shows.
    if (url) this.useElement(this.deps.createAudio(url));
  }

  setVolumes(volumes: ChannelVolumes): void {
    this.volumes = volumes;
    if (this.graph) {
      this.graph.gainL.gain.value = volumes.l;
      this.graph.gainR.gain.value = volumes.r;
    }
  }

  /** Must be called from a user gesture (iOS unlocks audio only there). */
  play(): void {
    if (this.disposed || !this.url || this.isPlaying) return;

    const state = this.graph?.ctx.state as string | undefined;
    if (!this.graph || this.rebuildNeeded || state === "closed" || state === "interrupted") {
      // An element connected to the old context can't be moved to a new one.
      if (this.source) this.freshElementNeeded = true;
      this.closeGraph();
      this.buildGraph();
      this.rebuildNeeded = false;
    }
    if (this.freshElementNeeded || !this.audio) {
      this.useElement(this.deps.createAudio(this.url), this.position);
      this.freshElementNeeded = false;
    }

    const audio = this.audio!;
    if (this.graph && !this.source) {
      this.source = this.graph.ctx.createMediaElementSource(audio);
      this.source.connect(this.graph.splitter);
    }
    if (this.graph) {
      const { ctx, master } = this.graph;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.value = 1;
      if (ctx.state !== "running") ctx.resume().catch(() => undefined);
    }

    const startedAt = audio.currentTime;
    const played = audio.play();
    // Older engines return undefined instead of a promise.
    played?.catch?.((error: unknown) => {
      if (this.audio !== audio) return;
      console.error("Backing track did not start:", error);
      this.stall();
    });
    this.watchStart(audio, startedAt);
  }

  pause(): void {
    this.clearStallWatch();
    const audio = this.audio;
    if (!audio) return;
    audio.pause();
    // Resuming from the same spot: the buffered samples are the right ones.
    this.position = audio.currentTime;
  }

  stop(): void {
    this.seekPaused(0, true);
  }

  seek(time: number): void {
    const audio = this.audio;
    if (!audio) return;
    if (!audio.paused) {
      audio.currentTime = time;
      this.muteBriefly();
      this.watchStart(audio, time);
      return;
    }
    this.seekPaused(time, false);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearStallWatch();
    this.releaseElement();
    this.closeGraph();
  }

  private seekPaused(time: number, stopping: boolean): void {
    this.clearStallWatch();
    const audio = this.audio;
    if (!audio) return;
    if (stopping) audio.pause();
    this.position = time;
    // A paused element still at 0 (never played) has nothing buffered.
    if (!(audio.paused && audio.currentTime === 0 && time === 0)) this.freshElementNeeded = true;
    this.listener.onTimeUpdate(time);
    if (stopping) this.listener.onPlayingChange(false);
  }

  private buildGraph(): void {
    const ctx = this.deps.createContext();
    if (!ctx) return;
    const splitter = ctx.createChannelSplitter(2);
    const gainL = ctx.createGain();
    const gainR = ctx.createGain();
    const merger = ctx.createChannelMerger(2);
    const master = ctx.createGain();
    splitter.connect(gainL, 0);
    splitter.connect(gainR, 1);
    gainL.connect(merger, 0, 0);
    gainR.connect(merger, 0, 1);
    merger.connect(master);
    master.connect(ctx.destination);
    gainL.gain.value = this.volumes.l;
    gainR.gain.value = this.volumes.r;
    master.gain.value = 1;
    // iOS interrupts the output (a call, Siri, another app): stop honestly.
    // While a start is being watched, the watchdog decides (the context may
    // still be moving to "running").
    ctx.onstatechange = () => {
      if (this.graph?.ctx !== ctx || this.stallTimer !== null) return;
      if (ctx.state !== "running" && this.isPlaying) this.stall();
    };
    this.graph = { ctx, splitter, gainL, gainR, master };
  }

  private closeGraph(): void {
    this.source?.disconnect();
    this.source = null;
    const graph = this.graph;
    this.graph = null;
    if (graph) {
      graph.ctx.onstatechange = null;
      graph.ctx.close().catch(() => undefined);
    }
  }

  private useElement(audio: HTMLAudioElement, startAt = 0): void {
    this.releaseElement();
    this.audio = audio;
    if (startAt > 0) {
      try {
        audio.currentTime = startAt;
      } catch {
        // Some engines refuse before metadata; applied on loadedmetadata below.
      }
    }

    const onTime = () => {
      // pause() fires a late timeupdate with the old position; after a stop or
      // seek the next play starts elsewhere, so it would show the wrong time.
      if (audio.paused && this.freshElementNeeded) return;
      this.listener.onTimeUpdate(audio.currentTime);
    };
    const onDuration = () => {
      if (Number.isFinite(audio.duration)) this.listener.onDurationChange(audio.duration);
    };
    const onMetadata = () => {
      onDuration();
      if (startAt > 0 && Math.abs(audio.currentTime - startAt) > 0.25 && audio.currentTime < startAt) {
        audio.currentTime = startAt;
      }
    };
    const onPlay = () => this.listener.onPlayingChange(true);
    const onPause = () => this.listener.onPlayingChange(false);
    const onEnded = () => {
      this.clearStallWatch();
      this.position = 0;
      this.freshElementNeeded = true;
      this.listener.onPlayingChange(false);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onDuration);
    audio.addEventListener("loadedmetadata", onMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    this.detachAudio = () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onDuration);
      audio.removeEventListener("loadedmetadata", onMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }

  private releaseElement(): void {
    const audio = this.audio;
    this.detachAudio?.();
    this.detachAudio = null;
    this.source?.disconnect();
    this.source = null;
    this.audio = null;
    if (!audio) return;
    audio.pause();
    // Frees the decoder; the blob URL belongs to useLocalBackingTracks.
    audio.removeAttribute("src");
    audio.load();
  }

  private muteBriefly(): void {
    const graph = this.graph;
    if (!graph) return;
    const { ctx, master } = graph;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(0, now);
    master.gain.setValueAtTime(0, now + SEEK_MUTE_S);
    master.gain.linearRampToValueAtTime(1, now + SEEK_MUTE_S + 0.04);
  }

  private watchStart(audio: HTMLAudioElement, startedAt: number): void {
    this.clearStallWatch();
    this.stallTimer = this.deps.setTimeout(() => {
      this.stallTimer = null;
      if (this.audio !== audio || audio.paused) return;
      const moved = audio.currentTime - startedAt >= STALL_MIN_PROGRESS_S;
      const outputOk = !this.graph || this.graph.ctx.state === "running";
      if (!moved || !outputOk) this.stall();
    }, STALL_TIMEOUT_MS);
  }

  private stall(): void {
    this.clearStallWatch();
    this.rebuildNeeded = true;
    const audio = this.audio;
    if (audio) {
      audio.pause();
      this.position = audio.currentTime;
    }
    this.listener.onPlayingChange(false);
    this.listener.onStalled();
  }

  private clearStallWatch(): void {
    if (this.stallTimer !== null) this.deps.clearTimeout(this.stallTimer);
    this.stallTimer = null;
  }
}
