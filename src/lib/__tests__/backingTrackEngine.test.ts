import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BackingTrackEngine,
  STALL_TIMEOUT_MS,
  type BackingTrackEngineDeps,
  type BackingTrackEngineListener,
} from "../backingTrackEngine";

class FakeAudio {
  src: string;
  paused = true;
  currentTime = 0;
  duration = 120;
  readyState = 4;
  networkState = 1;
  error = null;
  released = false;
  playResult: Promise<void> = Promise.resolve();
  private listeners = new Map<string, Set<() => void>>();
  constructor(url: string) {
    this.src = url;
  }
  addEventListener(type: string, fn: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }
  removeEventListener(type: string, fn: () => void) {
    this.listeners.get(type)?.delete(fn);
  }
  emit(type: string) {
    for (const fn of this.listeners.get(type) ?? []) fn();
  }
  play() {
    this.paused = false;
    this.emit("play");
    return this.playResult;
  }
  pause() {
    if (this.paused) return;
    this.paused = true;
    this.emit("pause");
  }
  removeAttribute() {
    this.released = true;
  }
  load() {}
}

class FakeParam {
  value = 1;
  cancelScheduledValues() {}
  setValueAtTime() {}
  linearRampToValueAtTime() {}
}

function node() {
  return { connect: vi.fn(), disconnect: vi.fn(), gain: new FakeParam() };
}

class FakeContext {
  state: string = "suspended";
  currentTime = 0;
  closed = false;
  onstatechange: (() => void) | null = null;
  destination = {};
  sources: FakeAudio[] = [];
  resume = vi.fn(() => {
    if (this.state === "suspended") this.state = "running";
    return Promise.resolve();
  });
  close = vi.fn(() => {
    this.closed = true;
    this.state = "closed";
    return Promise.resolve();
  });
  createMediaElementSource(audio: FakeAudio) {
    if (this.sources.includes(audio)) throw new Error("already connected");
    this.sources.push(audio);
    return node();
  }
  createChannelSplitter = node;
  createChannelMerger = node;
  createGain = node;
  setState(state: string) {
    this.state = state;
    this.onstatechange?.();
  }
}

let audios: FakeAudio[];
let contexts: FakeContext[];
let timers: Array<{ fn: () => void; cleared: boolean }>;
let listener: { [K in keyof BackingTrackEngineListener]: ReturnType<typeof vi.fn> };
let engine: BackingTrackEngine;

function runTimers() {
  const pending = timers.filter((timer) => !timer.cleared);
  timers = [];
  pending.forEach((timer) => timer.fn());
}

const current = () => audios[audios.length - 1];
const ctx = () => contexts[contexts.length - 1];

beforeEach(() => {
  audios = [];
  contexts = [];
  timers = [];
  listener = {
    onTimeUpdate: vi.fn(),
    onDurationChange: vi.fn(),
    onPlayingChange: vi.fn(),
    onStalled: vi.fn(),
  };
  const deps: BackingTrackEngineDeps = {
    createAudio: (url) => {
      const audio = new FakeAudio(url);
      audios.push(audio);
      return audio as unknown as HTMLAudioElement;
    },
    createContext: () => {
      const context = new FakeContext();
      contexts.push(context);
      return context as unknown as AudioContext;
    },
    setTimeout: (fn, ms) => {
      expect(ms).toBe(STALL_TIMEOUT_MS);
      const timer = { fn, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimeout: (handle) => {
      (handle as { cleared: boolean }).cleared = true;
    },
    log: vi.fn(),
  };
  engine = new BackingTrackEngine(listener as unknown as BackingTrackEngineListener, deps);
  engine.setSource("blob:track");
});

describe("BackingTrackEngine", () => {
  it("plays through a Web Audio graph built on the first play", () => {
    expect(contexts).toHaveLength(0);
    engine.play();
    expect(contexts).toHaveLength(1);
    expect(ctx().sources).toEqual([audios[0]]);
    expect(ctx().resume).toHaveBeenCalled();
    expect(engine.isPlaying).toBe(true);
    expect(listener.onPlayingChange).toHaveBeenLastCalledWith(true);
  });

  it("restarts after stop on a fresh element (no stale samples) in the same context", () => {
    engine.play();
    current().currentTime = 42;
    engine.stop();
    expect(engine.isPlaying).toBe(false);
    expect(listener.onTimeUpdate).toHaveBeenLastCalledWith(0);
    // Created at the stop, not in the next tap: it loads in the meantime.
    expect(audios).toHaveLength(2);
    expect(audios[0].released).toBe(true);
    expect(audios[1].paused).toBe(true);

    engine.play();
    expect(audios).toHaveLength(2);
    expect(current().currentTime).toBe(0);
    expect(current().paused).toBe(false);
    expect(contexts).toHaveLength(1);
    expect(ctx().sources).toEqual([audios[0], audios[1]]);
  });

  it("ignores the late timeupdate a stop's pause() fires", () => {
    engine.play();
    current().currentTime = 42;
    engine.stop();
    current().emit("timeupdate");
    expect(listener.onTimeUpdate).toHaveBeenLastCalledWith(0);
  });

  it("resumes after a pause on the same element", () => {
    engine.play();
    current().currentTime = 30;
    engine.pause();
    engine.play();
    expect(audios).toHaveLength(1);
    expect(current().currentTime).toBe(30);
  });

  it("a seek while paused starts a fresh element at that position", () => {
    engine.play();
    current().currentTime = 10;
    engine.pause();
    engine.seek(75);
    expect(listener.onTimeUpdate).toHaveBeenLastCalledWith(75);
    engine.play();
    expect(audios).toHaveLength(2);
    expect(current().currentTime).toBe(75);
  });

  it("a seek while playing moves the same element", () => {
    engine.play();
    engine.seek(50);
    expect(audios).toHaveLength(1);
    expect(current().currentTime).toBe(50);
  });

  it("after the track ends, play starts over on a fresh element", () => {
    engine.play();
    current().currentTime = 120;
    current().paused = true;
    current().emit("ended");
    expect(audios).toHaveLength(2);
    engine.play();
    expect(audios).toHaveLength(2);
    expect(current().currentTime).toBe(0);
  });

  it("does not replace the element for a stop before anything played", () => {
    engine.stop();
    engine.play();
    expect(audios).toHaveLength(1);
  });

  describe("stall watchdog", () => {
    it("keeps playing when the time advances and the context runs", () => {
      engine.play();
      current().currentTime = 1.4;
      runTimers();
      expect(listener.onStalled).not.toHaveBeenCalled();
      expect(engine.isPlaying).toBe(true);
    });

    it("pauses and reports a stall when the time does not advance (iOS)", () => {
      engine.play();
      runTimers();
      expect(listener.onStalled).toHaveBeenCalledTimes(1);
      expect(engine.isPlaying).toBe(false);
      expect(listener.onPlayingChange).toHaveBeenLastCalledWith(false);
    });

    it("reports a stall when the context is not running, even if the time moved", () => {
      engine.play();
      ctx().state = "interrupted";
      current().currentTime = 1.4;
      runTimers();
      expect(listener.onStalled).toHaveBeenCalledTimes(1);
    });

    it("the next play after a stall rebuilds the context and the element", () => {
      engine.play();
      current().currentTime = 0.01;
      runTimers();
      const [firstContext] = contexts;
      // The dead graph goes and the replacement element loads before the tap.
      expect(firstContext.closed).toBe(true);
      expect(audios).toHaveLength(2);
      expect(audios[1].paused).toBe(true);

      engine.play();
      expect(firstContext.closed).toBe(true);
      expect(contexts).toHaveLength(2);
      expect(audios).toHaveLength(2);
      expect(ctx().sources).toEqual([audios[1]]);
      expect(current().currentTime).toBe(0.01);
      expect(engine.isPlaying).toBe(true);
    });

    it("a play() rejection is a stall", async () => {
      current().playResult = Promise.reject(new DOMException("denied", "NotAllowedError"));
      const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
      engine.play();
      await Promise.resolve();
      await Promise.resolve();
      expect(listener.onStalled).toHaveBeenCalledTimes(1);
      error.mockRestore();
    });

    it("a stop cancels the watchdog", () => {
      engine.play();
      engine.stop();
      runTimers();
      expect(listener.onStalled).not.toHaveBeenCalled();
    });

    it("an interruption while playing stops honestly", () => {
      engine.play();
      current().currentTime = 1.4;
      runTimers();
      ctx().setState("interrupted");
      expect(listener.onStalled).toHaveBeenCalledTimes(1);
      expect(engine.isPlaying).toBe(false);
    });

    it("leaves a state change during the start to the watchdog", () => {
      engine.play();
      ctx().setState("suspended");
      expect(listener.onStalled).not.toHaveBeenCalled();
      ctx().setState("running");
      current().currentTime = 1.4;
      runTimers();
      expect(listener.onStalled).not.toHaveBeenCalled();
      expect(engine.isPlaying).toBe(true);
    });

    it("a context already interrupted at play time is rebuilt right away", () => {
      engine.play();
      engine.pause();
      ctx().state = "interrupted";
      engine.play();
      expect(contexts).toHaveLength(2);
      expect(audios).toHaveLength(2);
    });
  });

  it("logs each play, the watchdog's verdict and a stall's reason", () => {
    const log = (engine as unknown as { deps: BackingTrackEngineDeps }).deps.log;
    engine.play();
    expect(log).toHaveBeenCalledWith("play", expect.objectContaining({ createdNow: false }));
    runTimers();
    expect(log).toHaveBeenCalledWith("watchdog", expect.objectContaining({ ok: false }));
    expect(log).toHaveBeenCalledWith("stall", { reason: "time-stuck" });
  });

  it("setSource stops the old track and releases its element", () => {
    engine.play();
    engine.setSource("blob:other");
    expect(audios[0].released).toBe(true);
    expect(audios[0].paused).toBe(true);
    expect(current().src).toBe("blob:other");
    engine.play();
    expect(contexts).toHaveLength(1);
  });

  it("dispose closes the context", () => {
    engine.play();
    engine.dispose();
    expect(ctx().closed).toBe(true);
    expect(audios[0].released).toBe(true);
  });
});
