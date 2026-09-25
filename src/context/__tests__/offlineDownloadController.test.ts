import { describe, expect, it, vi } from "vitest";
import { OfflineDownloadController } from "../offlineDownloadController";
import type { OfflineDownloadDeps } from "../offlineDownloadController";
import { OfflineError } from "../../services/offlineSetlistService";
import type {
  DownloadPlan,
  DownloadProgress,
  DownloadResult,
  OfflineEvent,
  OfflineSnapshotMeta,
} from "../../services/offlineSetlistService";

function plan(setlistId: string): DownloadPlan {
  return {
    setlistId,
    bandId: 1,
    songCount: 3,
    filesToDownload: [],
    filesAlreadyPresent: [],
    filesToDelete: [],
    bytesToDownload: 0,
    filesWithUnknownSize: 0,
    bytesAlreadyPresent: 0,
    estimate: null,
  };
}

function progress(filesDone: number, filesTotal = 4): DownloadProgress {
  return {
    state: "downloading",
    filesDone,
    filesTotal,
    bytesDone: filesDone * 10,
    bytesTotal: filesTotal * 10,
    currentFile: { songTitle: "Song", name: "Lead" },
  };
}

function meta(setlistId: string, completeness: "complete" | "partial" = "complete"): OfflineSnapshotMeta {
  return {
    schemaVersion: 1,
    setlistId,
    bandId: 1,
    userId: "u",
    setlistName: `Setlist ${setlistId}`,
    savedAt: "2026-09-25T10:00:00.000Z",
    completeness,
    bytes: 0,
    fileCount: 0,
    missingFiles: [],
    fingerprint: { setlistUpdatedAt: "", songs: [], sheetMusic: [], hash: "" },
    freshness: "unknown",
    lastCheckedAt: null,
    rowsUpdatedAt: "2026-09-25T10:00:00.000Z",
    lastDiff: null,
    verifiedAt: null,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A controller with the service replaced by doubles; `emit` plays the service's events. */
function setup(overrides: Partial<OfflineDownloadDeps> = {}) {
  let listener: ((e: OfflineEvent) => void) | null = null;
  let onVisibility: (() => void) | null = null;
  const doc = {
    visibilityState: "visible" as DocumentVisibilityState,
    addEventListener: vi.fn((_type: string, fn: () => void) => {
      onVisibility = fn;
    }),
  };
  const wakeLock = { acquire: vi.fn(), release: vi.fn() };
  const deps: OfflineDownloadDeps = {
    downloadSetlist: vi.fn(),
    cancelDownload: vi.fn(),
    resumeInterruptedDownloads: vi.fn(async () => []),
    listInterruptedDownloads: vi.fn(async () => []),
    subscribe: (fn) => {
      listener = fn;
      return () => undefined;
    },
    wakeLock,
    document: doc as unknown as OfflineDownloadDeps["document"],
    now: () => new Date("2026-09-25T12:00:00.000Z"),
    ...overrides,
  };
  const controller = new OfflineDownloadController(deps);
  return {
    controller,
    deps,
    wakeLock,
    emit: (e: OfflineEvent) => listener?.(e),
    becomeVisible: () => onVisibility?.(),
  };
}

describe("OfflineDownloadController", () => {
  it("tracks a started download's progress and stores its result (A2)", async () => {
    const run = deferred<DownloadResult>();
    const { controller, deps, emit, wakeLock } = setup({ downloadSetlist: vi.fn(() => run.promise) });

    const done = controller.start(plan("s1"), "Friday");
    expect(controller.getState().active).toEqual({ setlistId: "s1", setlistName: "Friday", progress: null, origin: "user" });
    expect(deps.downloadSetlist).toHaveBeenCalledOnce();
    expect(wakeLock.acquire).toHaveBeenCalledOnce();

    emit({ type: "download-progress", setlistId: "s1", progress: progress(2) });
    expect(controller.getState().active?.progress?.filesDone).toBe(2);

    run.resolve({ state: "done", meta: meta("s1"), missingFiles: [], failure: null });
    const finished = await done;
    expect(finished).toMatchObject({ setlistId: "s1", state: "done", failureCode: null });
    expect(controller.getState().active).toBeNull();
    expect(controller.getState().results.s1.meta?.setlistId).toBe("s1");
    expect(wakeLock.release).toHaveBeenCalledOnce();
  });

  it("a subscriber that attaches mid-download reads the current progress (A4)", async () => {
    const run = deferred<DownloadResult>();
    const { controller, emit } = setup({ downloadSetlist: vi.fn(() => run.promise) });
    void controller.start(plan("s1"), "Friday");
    emit({ type: "download-progress", setlistId: "s1", progress: progress(3) });

    // A modal mounted now (after navigating back) sees the same state.
    const seen: number[] = [];
    controller.subscribe(() => seen.push(controller.getState().active?.progress?.filesDone ?? -1));
    expect(controller.getState().active?.progress?.filesDone).toBe(3);
    emit({ type: "download-progress", setlistId: "s1", progress: progress(4) });
    expect(seen).toEqual([4]);
    run.resolve({ state: "done", meta: meta("s1"), missingFiles: [], failure: null });
  });

  it("stores a pre-condition rejection as a failed result", async () => {
    const { controller } = setup({
      downloadSetlist: vi.fn(async () => {
        throw new OfflineError("download-in-progress");
      }),
    });
    const finished = await controller.start(plan("s1"), "Friday");
    expect(finished).toMatchObject({ state: "failed", failureCode: "download-in-progress" });
    expect(controller.getState().active).toBeNull();
  });

  it("an unexpected error is a failed result with code unknown", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { controller } = setup({ downloadSetlist: vi.fn(async () => Promise.reject(new Error("boom"))) });
    expect(await controller.start(plan("s1"), "Friday")).toMatchObject({ state: "failed", failureCode: "unknown" });
  });

  it("a second start while one runs keeps the running one as active", async () => {
    const run = deferred<DownloadResult>();
    const downloadSetlist = vi
      .fn()
      .mockImplementationOnce(() => run.promise)
      .mockImplementationOnce(async () => {
        throw new OfflineError("download-in-progress");
      });
    const { controller } = setup({ downloadSetlist });
    void controller.start(plan("s1"), "Friday");
    const second = await controller.start(plan("s2"), "Saturday");
    expect(second.failureCode).toBe("download-in-progress");
    expect(controller.getState().active?.setlistId).toBe("s1");
    run.resolve({ state: "done", meta: meta("s1"), missingFiles: [], failure: null });
  });

  it("plan failures are results too", () => {
    const { controller } = setup();
    controller.reportPlanFailure("s1", new OfflineError("offline"));
    expect(controller.getState().results.s1).toMatchObject({ state: "failed", failureCode: "offline" });
    controller.clearResult("s1");
    expect(controller.getState().results.s1).toBeUndefined();
  });

  it("cancel is delegated to the service", () => {
    const { controller, deps } = setup();
    controller.cancel("s1");
    expect(deps.cancelDownload).toHaveBeenCalledWith("s1");
  });

  it("resume shows resumed jobs as active, with the journal's name, and stores their results (A5)", async () => {
    const run = deferred<DownloadResult[]>();
    const { controller, emit, wakeLock } = setup({
      listInterruptedDownloads: vi.fn(async () => [{ setlistId: "s1", setlistName: "Friday", startedAt: "x" }]),
      resumeInterruptedDownloads: vi.fn(() => run.promise),
    });
    const resumed = controller.resume();
    expect(controller.resume()).toBe(resumed); // one run at a time
    await vi.waitFor(() => expect(controller.getState().active).toBeNull());
    await Promise.resolve();
    emit({ type: "download-progress", setlistId: "s1", progress: progress(1) });
    expect(controller.getState().active).toMatchObject({ setlistId: "s1", setlistName: "Friday", origin: "resume" });
    expect(wakeLock.acquire).toHaveBeenCalled();

    run.resolve([{ state: "done-with-errors", meta: meta("s1", "partial"), missingFiles: [], failure: null }]);
    const summary = await resumed;
    expect(summary.finished.map((f) => [f.setlistId, f.state])).toEqual([["s1", "done-with-errors"]]);
    expect(controller.getState().active).toBeNull();
    expect(wakeLock.release).toHaveBeenCalled();
  });

  it("resume pairs a failed result (no meta) with the job that reported progress, and counts stale discards", async () => {
    const run = deferred<DownloadResult[]>();
    const { controller, emit } = setup({ resumeInterruptedDownloads: vi.fn(() => run.promise) });
    const resumed = controller.resume();
    await Promise.resolve();
    await Promise.resolve();
    emit({ type: "download-progress", setlistId: "s2", progress: progress(0) });
    run.resolve([
      { state: "failed", meta: null, missingFiles: [], failure: new OfflineError("plan-stale") },
      { state: "failed", meta: null, missingFiles: [], failure: new OfflineError("offline") },
    ]);
    const summary = await resumed;
    expect(summary.staleDiscarded).toBe(1);
    expect(summary.finished).toEqual([expect.objectContaining({ setlistId: "s2", failureCode: "offline" })]);
  });

  it("the page becoming visible bumps the revision (interrupted notices re-read)", () => {
    const { controller, becomeVisible } = setup();
    const before = controller.getState().revision;
    becomeVisible();
    expect(controller.getState().revision).toBe(before + 1);
  });

  it("a store wipe forgets every result", () => {
    const { controller, emit } = setup();
    controller.reportPlanFailure("s1", new OfflineError("offline"));
    emit({ type: "store-wiped", reason: "sign-out" });
    expect(controller.getState().results).toEqual({});
  });

  it("viewers claim a setlist's results; releasing notifies subscribers", () => {
    const { controller } = setup();
    const release = controller.attachViewer("s1");
    const again = controller.attachViewer("s1");
    expect(controller.isViewed("s1")).toBe(true);
    release();
    release(); // idempotent
    expect(controller.isViewed("s1")).toBe(true);
    const notified = vi.fn();
    controller.subscribe(notified);
    again();
    expect(controller.isViewed("s1")).toBe(false);
    expect(notified).toHaveBeenCalled();
  });
});
