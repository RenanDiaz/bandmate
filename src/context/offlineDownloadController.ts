import type {
  DownloadPlan,
  DownloadProgress,
  DownloadResult,
  OfflineErrorCode,
  OfflineEvent,
  OfflineMissingFile,
  OfflineSnapshotMeta,
} from "../services/offlineSetlistService";
import {
  OfflineError,
  cancelDownload,
  downloadSetlist,
  listInterruptedDownloads,
  resumeInterruptedDownloads,
  subscribe as subscribeOffline,
} from "../services/offlineSetlistService";
import type { ScreenWakeLock } from "../lib/wakeLock";
import { createScreenWakeLock } from "../lib/wakeLock";

/**
 * Owns the running offline download for the UI (PR 2.3). The service keeps no
 * "current download" and no final result that can be read back later: it
 * returns the result to downloadSetlist's caller and emits progress events. A
 * component that started a download may unmount (navigation) before it ends,
 * so this app-lifetime controller holds the promise, the latest progress and
 * each setlist's last result; the progress modal re-attaches by reading it
 * (A4). Plain TypeScript, no React; read through useOfflineDownloadState().
 *
 * It also keeps the screen awake while a download runs (iOS suspends the page
 * when the screen locks) and bumps `revision` when the page becomes visible
 * again, so interrupted-download notices re-read right away.
 */

export interface ActiveDownload {
  setlistId: string;
  setlistName: string;
  /** null until the first progress event. */
  progress: DownloadProgress | null;
  /** "user": started here with start(); "resume": a journal picked up by resume(). */
  origin: "user" | "resume";
}

export type DownloadFailureCode = OfflineErrorCode | "unknown";

export interface FinishedDownload {
  setlistId: string;
  state: DownloadResult["state"];
  meta: OfflineSnapshotMeta | null;
  missingFiles: OfflineMissingFile[];
  /** Why a `failed` (or `cancelled`) download ended; null otherwise. */
  failureCode: DownloadFailureCode | null;
  finishedAt: string;
}

export interface OfflineDownloadState {
  active: ActiveDownload | null;
  results: Readonly<Record<string, FinishedDownload>>;
  /** Bumped when interrupted downloads may have changed (resume, discard, page visible again). */
  revision: number;
}

export interface ResumeSummary {
  finished: FinishedDownload[];
  /** Journals older than 7 days that the service discarded (§4.4). */
  staleDiscarded: number;
}

export interface OfflineDownloadDeps {
  downloadSetlist: typeof downloadSetlist;
  cancelDownload: typeof cancelDownload;
  resumeInterruptedDownloads: typeof resumeInterruptedDownloads;
  listInterruptedDownloads: typeof listInterruptedDownloads;
  subscribe: (listener: (e: OfflineEvent) => void) => () => void;
  wakeLock: ScreenWakeLock;
  document?: Pick<Document, "visibilityState" | "addEventListener">;
  now?: () => Date;
}

function failureCodeOf(error: unknown): DownloadFailureCode {
  return error instanceof OfflineError ? error.code : "unknown";
}

export class OfflineDownloadController {
  private state: OfflineDownloadState = { active: null, results: {}, revision: 0 };
  private readonly listeners = new Set<() => void>();
  private resumeRun: Promise<ResumeSummary> | null = null;
  /** Names of interrupted journals, read before resuming (progress events carry only the id). */
  private resumeNames = new Map<string, string>();
  /** Setlist ids in the order resumed jobs reported progress. */
  private resumeSeen: string[] = [];
  private readonly deps: OfflineDownloadDeps;
  private readonly viewers = new Map<string, number>();

  constructor(deps: OfflineDownloadDeps) {
    this.deps = deps;
    deps.subscribe((event) => this.onOfflineEvent(event));
    deps.document?.addEventListener("visibilitychange", () => {
      if (deps.document?.visibilityState === "visible") this.bumpRevision();
    });
  }

  getState = (): OfflineDownloadState => this.state;

  /**
   * A mounted UI that shows this setlist's result itself (its page, or an open
   * modal) claims it; results nobody views are announced by
   * useOfflineDownloadNotifier() as toasts instead. Returns the release.
   */
  attachViewer(setlistId: string): () => void {
    this.viewers.set(setlistId, (this.viewers.get(setlistId) ?? 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const count = (this.viewers.get(setlistId) ?? 1) - 1;
      if (count > 0) this.viewers.set(setlistId, count);
      else this.viewers.delete(setlistId);
      // Let the notifier pick up a result that is no longer viewed.
      for (const listener of [...this.listeners]) listener();
    };
  }

  isViewed(setlistId: string): boolean {
    return this.viewers.has(setlistId);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /**
   * Runs a plan from planDownload(). Never rejects: a pre-condition failure
   * (`download-in-progress`, `plan-stale`, `offline`, …) is stored as a
   * `failed` result for the setlist, like any other outcome.
   */
  start(plan: DownloadPlan, setlistName: string): Promise<FinishedDownload> {
    const setlistId = plan.setlistId;
    // Another download in this tab: the service refuses it; don't replace `active`.
    const claims = !this.state.active;
    this.update({
      active: claims ? { setlistId, setlistName, progress: null, origin: "user" } : this.state.active,
      results: this.withoutResult(setlistId),
    });
    if (claims) this.deps.wakeLock.acquire();

    return this.deps
      .downloadSetlist(plan)
      .then(
        (result) => this.finished(setlistId, result.state, result.meta, result.missingFiles, result.failure),
        (error: unknown) => {
          if (!(error instanceof OfflineError)) console.error("Offline download failed:", error);
          return this.finished(setlistId, "failed", null, [], error);
        }
      )
      .then((finished) => {
        if (claims && this.state.active?.setlistId === setlistId) this.clearActive();
        return finished;
      });
  }

  /** A planDownload() rejection, shown by the same result view as a failed download. */
  reportPlanFailure(setlistId: string, error: unknown): FinishedDownload {
    if (!(error instanceof OfflineError)) console.error("Offline download plan failed:", error);
    return this.finished(setlistId, "failed", null, [], error);
  }

  cancel(setlistId: string): void {
    this.deps.cancelDownload(setlistId);
    if (this.state.active?.setlistId !== setlistId) this.bumpRevision();
  }

  /** Discard an interrupted download (no job running for it). */
  discard(setlistId: string): void {
    this.cancel(setlistId);
  }

  clearResult(setlistId: string): void {
    if (!this.state.results[setlistId]) return;
    this.update({ results: this.withoutResult(setlistId) });
  }

  /**
   * resumeInterruptedDownloads() with progress shown like a started download.
   * One run at a time; a second call while one runs returns the same promise.
   */
  resume(): Promise<ResumeSummary> {
    if (this.resumeRun) return this.resumeRun;
    const run = (async (): Promise<ResumeSummary> => {
      try {
        const interrupted = await this.deps.listInterruptedDownloads();
        this.resumeNames = new Map(interrupted.map((j) => [j.setlistId, j.setlistName]));
      } catch {
        this.resumeNames = new Map();
      }
      this.resumeSeen = [];
      let results: DownloadResult[] = [];
      try {
        results = await this.deps.resumeInterruptedDownloads();
      } catch (error) {
        console.error("Could not resume offline downloads:", error);
      }
      const staleDiscarded = results.filter(
        (r) => r.state === "failed" && r.failure?.code === "plan-stale"
      ).length;
      const ran = results.filter((r) => !(r.state === "failed" && r.failure?.code === "plan-stale"));
      // Results carry the setlist id only in `meta`; pair the others with the
      // order jobs reported progress in, when that order is unambiguous.
      const pairable = ran.length === this.resumeSeen.length;
      const finished: FinishedDownload[] = [];
      ran.forEach((result, i) => {
        const setlistId = result.meta?.setlistId ?? (pairable ? this.resumeSeen[i] : undefined);
        if (!setlistId) return;
        finished.push(this.finished(setlistId, result.state, result.meta, result.missingFiles, result.failure));
      });
      if (this.state.active?.origin === "resume") this.clearActive();
      this.bumpRevision();
      return { finished, staleDiscarded };
    })();
    this.resumeRun = run;
    void run.finally(() => {
      if (this.resumeRun === run) this.resumeRun = null;
    });
    return run;
  }

  // -------------------------------------------------------------------------

  private onOfflineEvent(event: OfflineEvent): void {
    if (event.type === "download-progress") {
      const active = this.state.active;
      if (active?.setlistId === event.setlistId) {
        this.update({ active: { ...active, progress: event.progress } });
        return;
      }
      if (active?.origin === "user") return; // not ours to show (another job cannot run in this tab)
      // A resumed job (or the next one of a resume run).
      if (!this.resumeSeen.includes(event.setlistId)) this.resumeSeen.push(event.setlistId);
      if (!active) this.deps.wakeLock.acquire();
      this.update({
        active: {
          setlistId: event.setlistId,
          setlistName: this.resumeNames.get(event.setlistId) ?? "",
          progress: event.progress,
          origin: "resume",
        },
      });
      return;
    }
    if (event.type === "store-wiped") {
      // Results name setlists of a user whose copies are gone. A running job
      // was aborted by the wipe and settles as cancelled.
      this.update({ results: {}, revision: this.state.revision + 1 });
    } else if (event.type === "visibility-changed") {
      this.update({ results: {}, revision: this.state.revision + 1 });
    }
  }

  private finished(
    setlistId: string,
    state: DownloadResult["state"],
    meta: OfflineSnapshotMeta | null,
    missingFiles: OfflineMissingFile[],
    failure: unknown
  ): FinishedDownload {
    const finished: FinishedDownload = {
      setlistId,
      state,
      meta,
      missingFiles,
      failureCode: state === "failed" || state === "cancelled" ? failureCodeOf(failure) : null,
      finishedAt: (this.deps.now?.() ?? new Date()).toISOString(),
    };
    this.update({ results: { ...this.state.results, [setlistId]: finished }, revision: this.state.revision + 1 });
    return finished;
  }

  private clearActive(): void {
    this.deps.wakeLock.release();
    this.update({ active: null });
  }

  private withoutResult(setlistId: string): Record<string, FinishedDownload> {
    if (!this.state.results[setlistId]) return this.state.results as Record<string, FinishedDownload>;
    const { [setlistId]: _removed, ...rest } = this.state.results;
    void _removed;
    return rest;
  }

  private bumpRevision(): void {
    this.update({ revision: this.state.revision + 1 });
  }

  private update(patch: Partial<OfflineDownloadState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of [...this.listeners]) listener();
  }
}

let instance: OfflineDownloadController | null = null;

/** The app's controller, created on first use with the real service. */
export function getOfflineDownloadController(): OfflineDownloadController {
  instance ??= new OfflineDownloadController({
    downloadSetlist,
    cancelDownload,
    resumeInterruptedDownloads,
    listInterruptedDownloads,
    subscribe: subscribeOffline,
    wakeLock: createScreenWakeLock(),
    document: typeof document !== "undefined" ? document : undefined,
  });
  return instance;
}
