import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../setlistsService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../setlistsService")>()),
  getSetlist: vi.fn(),
}));
vi.mock("../songsService", () => ({ getSongsByIds: vi.fn() }));
vi.mock("../songSheetMusicService", () => ({ getSheetMusicForSongs: vi.fn() }));
vi.mock("../sheetMusicPreferencesService", () => ({
  getMySheetMusicPreferences: vi.fn(),
  getPreferredInstrument: vi.fn(),
}));
vi.mock("../bandsService", () => ({ getMyBands: vi.fn() }));
vi.mock("../sheetMusicStorageService", () => ({
  createSheetMusicDownloadUrl: vi.fn(),
  listSheetMusicFolderSizes: vi.fn(),
}));

import { createStore } from "idb-keyval";
import { getSetlist } from "../setlistsService";
import type { Setlist } from "../setlistsService";
import { getSongsByIds } from "../songsService";
import type { Song } from "../songsService";
import { getSheetMusicForSongs } from "../songSheetMusicService";
import type { SheetMusic } from "../songSheetMusicService";
import { getMySheetMusicPreferences, getPreferredInstrument } from "../sheetMusicPreferencesService";
import { getMyBands } from "../bandsService";
import { createSheetMusicDownloadUrl, listSheetMusicFolderSizes } from "../sheetMusicStorageService";
import {
  DOWNLOAD_LOCK_NAME,
  JOURNAL_MAX_AGE_MS,
  OFFLINE_SCHEMA_VERSION,
  OfflineError,
  PLAN_MAX_AGE_MS,
  cancelDownload,
  collectGarbage,
  confirmSignedInUser,
  downloadSetlist,
  getFile,
  getSnapshot,
  getStorageUsage,
  listInterruptedDownloads,
  listSnapshots,
  openOfflineStore,
  planDownload,
  removeSnapshot,
  requestPersistence,
  resumeInterruptedDownloads,
  setOfflineCurrentUser,
  subscribe,
  wipeAll,
} from "../offlineSetlistService";
import type { DownloadPlan, DownloadResult, OfflineDownloadJournal, OfflineEvent } from "../offlineSetlistService";
import {
  OFFLINE_DB_NAME,
  OFFLINE_STORE_NAME,
  StoreWriteError,
  __setWriteFaultForTests,
  offlineKeys,
} from "../../lib/offlineStore";
import { FILE_STALL_TIMEOUT_MS } from "../../lib/offlineFetch";
import { band, flush, rawEntries, rawKeys, resetOfflineTestEnv, seedRaw, snapshotRecords, storeMeta } from "../../test/offlineFixtures";

const USER_A = "user-a";
const USER_B = "user-b";
const BAND_ID = 7;

// ---------------------------------------------------------------------------
// A fake server: rows, storage listing and file bytes
// ---------------------------------------------------------------------------

interface FakeFile {
  bytes: number;
  /** HTTP status of the file GET (default 200). */
  status?: number;
  /** Error thrown by createSignedUrl instead of returning a URL. */
  signError?: unknown;
  /** Stream this many bytes, then never finish (a stall), unless `release` is called. */
  hangAfter?: number;
}

interface FakeServer {
  setlists: Record<string, Setlist>;
  songs: Song[];
  sheetMusic: SheetMusic[];
  files: Record<string, FakeFile>;
  fetched: string[];
  /** Resolves when the named path's GET starts. */
  onFetch: Map<string, () => void>;
  /** Pending hung streams, by path: call to finish them normally. */
  release: Map<string, () => void>;
}

let server: FakeServer;

function song(id: string, title = `Song ${id}`): Song {
  return { id, title, user_id: "owner", band_id: BAND_ID, created_at: "2026-01-01T00:00:00Z" };
}

function sheet(id: string, songId: string, position: number, name = `PDF ${id}`): SheetMusic {
  return {
    id,
    song_id: songId,
    name,
    file_url: `${BAND_ID}/${songId}/${id}.pdf`,
    page_timings: [],
    position,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-02-01T00:00:00Z",
  };
}

function setlist(id: string, songIds: string[], name = `Setlist ${id}`): Setlist {
  const items: Setlist["songs"] = [];
  songIds.forEach((songId, i) => {
    items.push({ type: "song", song_id: songId, position: items.length, id: `item-${id}-${i}` } as Setlist["songs"][number]);
    if (i === 0) items.push({ type: "break", id: `brk-${id}`, label: "Break", position: items.length } as Setlist["songs"][number]);
  });
  return {
    id,
    band_id: BAND_ID,
    user_id: "owner",
    name,
    songs: items,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-03-01T00:00:00.123456+00:00",
  };
}

const path = (smId: string, songId: string) => `${BAND_ID}/${songId}/${smId}.pdf`;
const A1 = path("a1", "a");
const A2 = path("a2", "a");
const B1 = path("b1", "b");
const B2 = path("b2", "b");
const D1 = path("d1", "d");

function defaultServer(): FakeServer {
  return {
    setlists: { s1: setlist("s1", ["a", "b", "c"]), s2: setlist("s2", ["a", "d"]) },
    songs: [song("a"), song("b"), song("c"), song("d")],
    sheetMusic: [sheet("a1", "a", 0), sheet("a2", "a", 1), sheet("b1", "b", 0), sheet("b2", "b", 1), sheet("d1", "d", 0)],
    files: { [A1]: { bytes: 100 }, [A2]: { bytes: 20 }, [B1]: { bytes: 300 }, [B2]: { bytes: 40 }, [D1]: { bytes: 50 } },
    fetched: [],
    onFetch: new Map(),
    release: new Map(),
  };
}

const URL_PREFIX = "https://storage.test/";

function fileResponse(filePath: string, file: FakeFile): Response {
  if (file.status && file.status !== 200) return new Response("error", { status: file.status });
  const total = file.bytes;
  const hangAfter = file.hangAfter;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      if (hangAfter === undefined) {
        controller.enqueue(new Uint8Array(total).fill(1));
        controller.close();
        return;
      }
      if (hangAfter > 0) controller.enqueue(new Uint8Array(hangAfter).fill(1));
      server.release.set(filePath, () => {
        // The reader may have cancelled the stream already (stall, abort).
        try {
          if (total - hangAfter > 0) controller.enqueue(new Uint8Array(total - hangAfter).fill(1));
          controller.close();
        } catch {
          // closed
        }
      });
    },
  });
  return new Response(stream, { status: 200, headers: { "content-length": String(total) } });
}

function installServer(): void {
  server = defaultServer();
  vi.mocked(getSetlist).mockImplementation(async (id) => {
    const row = server.setlists[id];
    if (!row) throw Object.assign(new Error("not found"), { code: "PGRST116" });
    return structuredClone(row);
  });
  vi.mocked(getSongsByIds).mockImplementation(async (ids) => server.songs.filter((s) => ids.includes(s.id)));
  vi.mocked(getSheetMusicForSongs).mockImplementation(async (ids) => {
    const grouped: Record<string, SheetMusic[]> = {};
    for (const id of ids) grouped[id] = server.sheetMusic.filter((sm) => sm.song_id === id);
    return grouped;
  });
  vi.mocked(getMySheetMusicPreferences).mockImplementation(async () => ({ a: "a2" }));
  vi.mocked(getPreferredInstrument).mockImplementation(() => null);
  vi.mocked(getMyBands).mockImplementation(async () => [band(BAND_ID)]);
  vi.mocked(listSheetMusicFolderSizes).mockImplementation(async (folder) => {
    const sizes: Record<string, number | null> = {};
    for (const [p, f] of Object.entries(server.files)) if (p.startsWith(`${folder}/`)) sizes[p] = f.bytes;
    return sizes;
  });
  vi.mocked(createSheetMusicDownloadUrl).mockImplementation(async (p) => {
    const file = server.files[p];
    if (file?.signError) throw file.signError;
    return `${URL_PREFIX}${p}`;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const filePath = url.slice(URL_PREFIX.length);
      server.fetched.push(filePath);
      server.onFetch.get(filePath)?.();
      if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const file = server.files[filePath];
      if (!file) return new Response("missing", { status: 404 });
      return fileResponse(filePath, file);
    })
  );
}

/** Resolves when the GET of `filePath` starts. */
function fetchStarted(filePath: string): Promise<void> {
  return new Promise((resolve) => server.onFetch.set(filePath, resolve));
}

function signIn(userId = USER_A): void {
  setOfflineCurrentUser(userId, { authenticated: true });
}

async function journalOf(setlistId: string): Promise<OfflineDownloadJournal | undefined> {
  return (await rawEntries())[offlineKeys.download(setlistId)] as OfflineDownloadJournal | undefined;
}

const fileKeys = async () => (await rawKeys()).filter((k) => k.startsWith("file:"));

beforeEach(async () => {
  resetOfflineTestEnv();
  installServer();
  await openOfflineStore();
  await confirmSignedInUser(USER_A);
  signIn();
});

afterEach(() => {
  __setWriteFaultForTests(null);
  for (const release of server.release.values()) release();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------

describe("planDownload (§4.2)", () => {
  it("inventories rows, files and sizes without writing", async () => {
    const before = await rawKeys();
    const plan = await planDownload("s1");
    expect(plan).toMatchObject({
      setlistId: "s1",
      bandId: BAND_ID,
      songCount: 3,
      filesAlreadyPresent: [],
      filesToDelete: [],
      bytesToDownload: 460,
      filesWithUnknownSize: 0,
      bytesAlreadyPresent: 0,
    });
    expect(plan.filesToDownload.map((f) => [f.storagePath, f.bytes])).toEqual([
      [A1, 100],
      [A2, 20],
      [B1, 300],
      [B2, 40],
    ]);
    expect(await rawKeys()).toEqual(before);
    // One listing per song folder that has files.
    expect(vi.mocked(listSheetMusicFolderSizes).mock.calls.map((c) => c[0]).sort()).toEqual([`${BAND_ID}/a`, `${BAND_ID}/b`]);
  });

  it("lists at most 4 folders at a time (C7)", async () => {
    const ids = Array.from({ length: 10 }, (_, i) => `x${i}`);
    server.setlists.big = setlist("big", ids);
    server.songs.push(...ids.map((id) => song(id)));
    server.sheetMusic.push(...ids.map((id) => sheet(`${id}-pdf`, id, 0)));
    let inFlight = 0;
    let peak = 0;
    vi.mocked(listSheetMusicFolderSizes).mockImplementation(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await flush(2);
      inFlight--;
      return {};
    });
    const plan = await planDownload("big");
    expect(peak).toBe(4);
    expect(plan.filesWithUnknownSize).toBe(10);
  });

  it("a folder whose listing fails counts under filesWithUnknownSize", async () => {
    vi.mocked(listSheetMusicFolderSizes).mockImplementation(async (folder) => {
      if (folder.endsWith("/b")) throw new Error("boom");
      return { [A1]: 100, [A2]: 20 };
    });
    const plan = await planDownload("s1");
    expect(plan.filesWithUnknownSize).toBe(2);
    expect(plan.bytesToDownload).toBe(120);
  });

  it("rejects with not-authenticated without a valid session (offline-cached, session-lost)", async () => {
    setOfflineCurrentUser(USER_A, { authenticated: false });
    await expect(planDownload("s1")).rejects.toMatchObject({ code: "not-authenticated" });
    setOfflineCurrentUser(null);
    await expect(planDownload("s1")).rejects.toMatchObject({ code: "not-authenticated" });
  });

  it("rejects with setlist-not-found and offline", async () => {
    await expect(planDownload("nope")).rejects.toMatchObject({ code: "setlist-not-found" });
    vi.mocked(getSetlist).mockRejectedValueOnce({ message: "TypeError: Failed to fetch", code: "" });
    await expect(planDownload("s1")).rejects.toMatchObject({ code: "offline" });
    vi.stubGlobal("navigator", { onLine: false });
    await expect(planDownload("s1")).rejects.toMatchObject({ code: "offline" });
  });
});

describe("downloadSetlist (§4.1)", () => {
  it("full download → complete snapshot", async () => {
    const events: OfflineEvent[] = [];
    subscribe((e) => events.push(e));
    const progress: number[] = [];
    const plan = await planDownload("s1");
    const result = await downloadSetlist(plan, { onProgress: (p) => progress.push(p.filesDone) });

    expect(result).toMatchObject({ state: "done", missingFiles: [], failure: null });
    expect(result.meta).toMatchObject({
      schemaVersion: OFFLINE_SCHEMA_VERSION,
      setlistId: "s1",
      bandId: BAND_ID,
      userId: USER_A,
      setlistName: "Setlist s1",
      completeness: "complete",
      bytes: 460,
      fileCount: 4,
      missingFiles: [],
      freshness: "unknown",
    });
    expect(result.meta?.fingerprint.setlistUpdatedAt).toBe("2026-03-01T00:00:00.123456+00:00");
    expect(result.meta?.fingerprint.hash).toMatch(/^[0-9a-f]{64}$/);

    expect(await listSnapshots()).toEqual([result.meta]);
    const snapshot = await getSnapshot("s1");
    expect(snapshot).toMatchObject({
      userId: USER_A,
      band: band(BAND_ID),
      preferredSheetMusicIds: { a: "a2" },
      localPreferenceOverrides: {},
    });
    expect(Object.keys(snapshot!.songsById).sort()).toEqual(["a", "b", "c"]);
    expect(snapshot!.files.map((f) => f.storagePath)).toEqual([A1, A2, B1, B2]);
    expect((await getFile(B1))?.size).toBe(300);
    expect((await getFile(B1))?.type).toBe("application/pdf");
    expect(await journalOf("s1")).toBeUndefined();
    expect(await rawKeys()).toContain(offlineKeys.band(BAND_ID));

    expect(progress[progress.length - 1]).toBe(4);
    expect(events).toContainEqual({ type: "snapshot-changed", setlistId: "s1" });
    expect(events.some((e) => e.type === "download-progress" && e.progress.state === "committing")).toBe(true);
  });

  it("files already present are skipped (matched by storage path only)", async () => {
    await downloadSetlist(await planDownload("s1"));
    server.fetched = [];
    // A renamed PDF keeps its path: not a new file.
    server.sheetMusic[0] = { ...server.sheetMusic[0], name: "Renamed", updated_at: "2026-09-01T00:00:00Z" };

    const plan = await planDownload("s1");
    expect(plan.filesToDownload).toEqual([]);
    expect(plan.filesAlreadyPresent.map((f) => f.storagePath)).toEqual([A1, A2, B1, B2]);
    expect(plan.bytesAlreadyPresent).toBe(460);
    const result = await downloadSetlist(plan);
    expect(result.state).toBe("done");
    expect(server.fetched).toEqual([]);

    // A second setlist sharing song "a" only fetches what it lacks.
    const result2 = await downloadSetlist(await planDownload("s2"));
    expect(result2.state).toBe("done");
    expect(server.fetched).toEqual([D1]);
  });

  it("per-file failures give a partial snapshot with missingFiles", async () => {
    server.files[A2] = { bytes: 20, status: 404 };
    server.files[B1] = { bytes: 300, status: 403 };
    server.files[B2] = { bytes: 40, signError: Object.assign(new Error("Object not found"), { status: 400 }) };
    const result = await downloadSetlist(await planDownload("s1"));

    expect(result.state).toBe("done-with-errors");
    expect(result.meta).toMatchObject({ completeness: "partial", bytes: 100, fileCount: 1 });
    expect(result.missingFiles).toEqual([
      { storagePath: A2, sheetMusicId: "a2", songId: "a", reason: "not-found", bytes: 20 },
      { storagePath: B1, sheetMusicId: "b1", songId: "b", reason: "forbidden", bytes: 300 },
      { storagePath: B2, sheetMusicId: "b2", songId: "b", reason: "not-found", bytes: 40 },
    ]);
    expect((await listSnapshots())[0].completeness).toBe("partial");
  });

  it("a 5xx or a failed fetch is a network failure, and the next files still download", async () => {
    server.files[A1] = { bytes: 100, status: 503 };
    vi.mocked(createSheetMusicDownloadUrl).mockImplementation(async (p) => {
      if (p === A2) throw Object.assign(new Error("Failed to fetch"), { name: "StorageUnknownError" });
      return `${URL_PREFIX}${p}`;
    });
    const result = await downloadSetlist(await planDownload("s1"));
    expect(result.missingFiles.map((m) => [m.storagePath, m.reason])).toEqual([
      [A1, "network"],
      [A2, "network"],
    ]);
    expect(result.meta?.fileCount).toBe(2);
  });

  it("retry after a partial download fetches only the missing files", async () => {
    server.files[B1] = { bytes: 300, status: 503 };
    await downloadSetlist(await planDownload("s1"));
    server.files[B1] = { bytes: 300 };
    server.fetched = [];
    const result = await downloadSetlist(await planDownload("s1"));
    expect(result.state).toBe("done");
    expect(server.fetched).toEqual([B1]);
  });
});

describe("QuotaExceededError (§4.5)", () => {
  it("a large file that doesn't fit is recorded; smaller files after it are still stored", async () => {
    // Order: A1 100, A2 20, B1 300, B2 40.
    __setWriteFaultForTests((key) =>
      key === offlineKeys.file(A1) ? new DOMException("full", "QuotaExceededError") : undefined
    );
    const result = await downloadSetlist(await planDownload("s1"));

    expect(result.state).toBe("done-with-errors");
    expect(result.missingFiles).toEqual([
      { storagePath: A1, sheetMusicId: "a1", songId: "a", reason: "quota", bytes: 100 },
      { storagePath: B1, sheetMusicId: "b1", songId: "b", reason: "quota", bytes: 300 },
    ]);
    // B1 (300 ≥ 100) was not even fetched; A2 and B2 are smaller and stored.
    expect(server.fetched).toEqual([A1, A2, B2]);
    expect(await fileKeys()).toEqual([offlineKeys.file(A2), offlineKeys.file(B2)].sort());
  });

  it("Safari's form (AbortError on the request, QuotaExceededError on the transaction) is caught too", async () => {
    __setWriteFaultForTests((key) =>
      key === offlineKeys.file(B1)
        ? new StoreWriteError(new DOMException("aborted", "AbortError"), new DOMException("full", "QuotaExceededError"))
        : undefined
    );
    const result = await downloadSetlist(await planDownload("s1"));
    expect(result.missingFiles).toEqual([
      { storagePath: B1, sheetMusicId: "b1", songId: "b", reason: "quota", bytes: 300 },
    ]);
    expect(result.meta?.fileCount).toBe(3);
  });

  it("a file of unknown size is compared with the ceiling once fetched", async () => {
    vi.mocked(listSheetMusicFolderSizes).mockResolvedValue({});
    __setWriteFaultForTests((key) =>
      key === offlineKeys.file(A2) ? new DOMException("full", "QuotaExceededError") : undefined
    );
    const result = await downloadSetlist(await planDownload("s1"));
    // Ceiling 20 after A2: B1 (300) and B2 (40) are refused once their size is known.
    expect(result.missingFiles.map((m) => [m.storagePath, m.reason, m.bytes])).toEqual([
      [A2, "quota", 20],
      [B1, "quota", 300],
      [B2, "quota", 40],
    ]);
  });

  it("commit quota → GC → retry succeeds", async () => {
    await seedRaw({ [offlineKeys.file("9/orphan/o.pdf")]: { storagePath: "9/orphan/o.pdf", blob: new Blob(["x"]), bytes: 1, downloadedAt: "" } });
    let failures = 0;
    __setWriteFaultForTests((key) => {
      if (key === offlineKeys.snapshotMeta("s1") && failures === 0) {
        failures++;
        return new DOMException("full", "QuotaExceededError");
      }
      return undefined;
    });
    const result = await downloadSetlist(await planDownload("s1"));
    expect(result.state).toBe("done");
    expect(await fileKeys()).not.toContain(offlineKeys.file("9/orphan/o.pdf"));
  });

  it("commit quota twice → failed quota-rows, journal deleted, files left to GC", async () => {
    __setWriteFaultForTests((key) =>
      key === offlineKeys.snapshotMeta("s1") ? new DOMException("full", "QuotaExceededError") : undefined
    );
    const result = await downloadSetlist(await planDownload("s1"));
    expect(result).toMatchObject({ state: "failed", meta: null });
    expect(result.failure).toBeInstanceOf(OfflineError);
    expect(result.failure?.code).toBe("quota-rows");
    const keys = await rawKeys();
    expect(keys).not.toContain(offlineKeys.download("s1"));
    expect(keys).not.toContain(offlineKeys.snapshotMeta("s1"));
    // Nothing references the downloaded files any more: GC reclaimed them.
    expect(await fileKeys()).toEqual([]);
  });
});

describe("stall timeout (§9 #6)", () => {
  it("60 s without progress records the file as network and moves on", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    server.files[A2] = { bytes: 20, hangAfter: 5 };
    const started = fetchStarted(A2);
    const done = downloadSetlist(await planDownload("s1"));
    await started;
    await flush();
    await vi.advanceTimersByTimeAsync(FILE_STALL_TIMEOUT_MS - 1000);
    await flush();
    // Still waiting: 59 s is not a stall.
    expect(server.fetched).toEqual([A1, A2]);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await done;
    expect(result.missingFiles.map((m) => [m.storagePath, m.reason])).toEqual([[A2, "network"]]);
    expect(server.fetched).toEqual([A1, A2, B1, B2]);
  });

  it("slow progress is not a stall: each chunk re-arms the timer", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    server.files[A1] = { bytes: 100, hangAfter: 10 };
    const started = fetchStarted(A1);
    const done = downloadSetlist(await planDownload("s1"));
    await started;
    await flush();
    await vi.advanceTimersByTimeAsync(FILE_STALL_TIMEOUT_MS - 1);
    server.release.get(A1)!();
    const result = await done;
    expect(result.state).toBe("done");
  });
});

describe("cancel (§4.4)", () => {
  it("cancelDownload mid-file aborts the fetch, deletes the journal, GC reclaims the files", async () => {
    server.files[B1] = { bytes: 300, hangAfter: 10 };
    const started = fetchStarted(B1);
    const done = downloadSetlist(await planDownload("s1"));
    await started;
    await flush();
    expect(await journalOf("s1")).toBeDefined();
    cancelDownload("s1");
    const result = await done;
    expect(result).toMatchObject({ state: "cancelled", meta: null });
    expect(result.failure?.code).toBe("cancelled");
    expect(await journalOf("s1")).toBeUndefined();
    expect(await rawKeys()).not.toContain(offlineKeys.snapshotMeta("s1"));
    expect(server.fetched).toEqual([A1, A2, B1]);
    expect(await fileKeys()).toEqual([]);
  });

  it("the caller's AbortSignal cancels too", async () => {
    server.files[A1] = { bytes: 100, hangAfter: 0 };
    const controller = new AbortController();
    const started = fetchStarted(A1);
    const done = downloadSetlist(await planDownload("s1"), { signal: controller.signal });
    await started;
    controller.abort();
    expect((await done).state).toBe("cancelled");
  });

  it("with no download running, cancelDownload discards the interrupted journal", async () => {
    await makeInterruptedJournal();
    expect(await listInterruptedDownloads()).toEqual([
      { setlistId: "s1", setlistName: "Setlist s1", startedAt: expect.any(String) },
    ]);
    cancelDownload("s1");
    await flush();
    expect(await journalOf("s1")).toBeUndefined();
    expect(await fileKeys()).toEqual([]);
  });
});

/**
 * Downloads A1 and A2, then the device goes offline before B1: the journal
 * stays with A1/A2 stored. Then, like a killed page, B1/B2 lose their
 * recorded outcome. Leaves the device online again.
 */
async function makeInterruptedJournal(): Promise<OfflineDownloadJournal> {
  const realNavigator = globalThis.navigator;
  vi.mocked(createSheetMusicDownloadUrl).mockImplementation(async (p) => {
    if (p === A2) vi.stubGlobal("navigator", { onLine: false, locks: realNavigator.locks });
    return `${URL_PREFIX}${p}`;
  });
  const result = await downloadSetlist(await planDownload("s1"));
  expect(result.failure?.code).toBe("offline");
  vi.unstubAllGlobals();
  installServerKeepingState();
  const journal = (await journalOf("s1"))!;
  const outcomes = { ...journal.outcomes };
  delete outcomes[B1];
  delete outcomes[B2];
  const killed = { ...journal, outcomes };
  await seedRaw({ [offlineKeys.download("s1")]: killed });
  return killed;
}

/** Re-installs the mocks after vi.unstubAllGlobals() without resetting the server. */
function installServerKeepingState(): void {
  const saved = server;
  installServer();
  server = saved;
}

describe("resume (§4.4)", () => {
  it("resumes from the journal without re-fetching stored files", async () => {
    await makeInterruptedJournal();
    expect(server.fetched).toEqual([A1, A2]);
    expect(await fileKeys()).toEqual([offlineKeys.file(A1), offlineKeys.file(A2)].sort());

    const results = await resumeInterruptedDownloads();
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ state: "done", meta: { completeness: "complete", bytes: 460 } });
    // The rows came from the journal: no planning queries on resume.
    expect(vi.mocked(getSetlist)).toHaveBeenCalledTimes(1);
    expect(server.fetched).toEqual([A1, A2, B1, B2]);
    expect(await journalOf("s1")).toBeUndefined();
  });

  it("a stored outcome whose file is gone is fetched again", async () => {
    await makeInterruptedJournal();
    const entries = await rawEntries();
    delete entries[offlineKeys.file(A1)];
    resetOfflineTestEnv();
    installServerKeepingState();
    await seedRaw(entries);
    await openOfflineStore();
    signIn();
    server.fetched = [];
    const [result] = await resumeInterruptedDownloads();
    expect(result.state).toBe("done");
    expect(server.fetched).toEqual([A1, B1, B2]);
  });

  it("stays put offline and without a valid session", async () => {
    await makeInterruptedJournal();
    vi.stubGlobal("navigator", { onLine: false });
    expect(await resumeInterruptedDownloads()).toEqual([]);
    vi.unstubAllGlobals();
    installServerKeepingState();
    setOfflineCurrentUser(USER_A, { authenticated: false });
    expect(await resumeInterruptedDownloads()).toEqual([]);
    expect(await journalOf("s1")).toBeDefined();
  });

  it("does not touch another user's journal", async () => {
    const journal = await makeInterruptedJournal();
    await seedRaw({ [offlineKeys.download("s1")]: { ...journal, userId: USER_B } });
    expect(await resumeInterruptedDownloads()).toEqual([]);
    expect(await listInterruptedDownloads()).toEqual([]);
    expect(await journalOf("s1")).toBeDefined();
  });

  it("a journal older than 7 days is discarded, and its files are GC'd", async () => {
    const journal = await makeInterruptedJournal();
    const old = new Date(Date.now() - JOURNAL_MAX_AGE_MS - 60_000).toISOString();
    await seedRaw({ [offlineKeys.download("s1")]: { ...journal, startedAt: old } });
    server.fetched = [];
    const results = await resumeInterruptedDownloads();
    expect(results).toHaveLength(1);
    expect(results[0].state).toBe("failed");
    expect(results[0].failure?.code).toBe("plan-stale");
    expect(server.fetched).toEqual([]);
    expect(await journalOf("s1")).toBeUndefined();
    expect(await fileKeys()).toEqual([]);
  });
});

describe("pre-conditions (§5.4)", () => {
  it("plan-stale: older than 10 minutes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const plan = await planDownload("s1");
    vi.setSystemTime(Date.now() + PLAN_MAX_AGE_MS + 1);
    await expect(downloadSetlist(plan)).rejects.toMatchObject({ code: "plan-stale" });
    expect(await journalOf("s1")).toBeUndefined();
  });

  it("plan-stale: a plan not made by planDownload() on this page", async () => {
    const plan = structuredClone(await planDownload("s1")) as DownloadPlan;
    await expect(downloadSetlist(plan)).rejects.toMatchObject({ code: "plan-stale" });
  });

  it("plan-stale: the setlist already has a newer journal", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const older = await planDownload("s1");
    vi.setSystemTime(Date.now() + 1000);
    await makeInterruptedJournal();
    await expect(downloadSetlist(older)).rejects.toMatchObject({ code: "plan-stale" });
  });

  it("not-authenticated when the session is gone or belongs to someone else", async () => {
    const plan = await planDownload("s1");
    setOfflineCurrentUser(USER_A, { authenticated: false });
    await expect(downloadSetlist(plan)).rejects.toMatchObject({ code: "not-authenticated" });
    signIn(USER_B);
    await expect(downloadSetlist(plan)).rejects.toMatchObject({ code: "not-authenticated" });
  });

  it("download-in-progress in the same tab", async () => {
    server.files[A1] = { bytes: 100, hangAfter: 0 };
    const started = fetchStarted(A1);
    const first = downloadSetlist(await planDownload("s1"));
    await started;
    const second = await planDownload("s2");
    await expect(downloadSetlist(second)).rejects.toMatchObject({ code: "download-in-progress" });
    server.release.get(A1)!();
    expect((await first).state).toBe("done");
  });

  it("download-in-progress when another tab holds the lock (race rule 4)", async () => {
    let releaseLock!: () => void;
    const held = new Promise<void>((resolve) => (releaseLock = resolve));
    let acquired!: () => void;
    const isHeld = new Promise<void>((resolve) => (acquired = resolve));
    const otherTab = navigator.locks.request(DOWNLOAD_LOCK_NAME, async () => {
      acquired();
      await held;
    });
    await isHeld;
    const plan = await planDownload("s1");
    await expect(downloadSetlist(plan)).rejects.toMatchObject({ code: "download-in-progress" });
    expect(await journalOf("s1")).toBeUndefined();
    expect(server.fetched).toEqual([]);

    await releaseAndDownloadAgain(releaseLock, otherTab);
  });
});

/** Once the other tab releases the lock, a download works again. */
async function releaseAndDownloadAgain(releaseLock: () => void, otherTab: Promise<unknown>): Promise<void> {
  releaseLock();
  await otherTab;
  const result = await downloadSetlist(await planDownload("s1"));
  expect(result.state).toBe("done");
}

describe("garbage collection (§4.6)", () => {
  it("files shared by two snapshots survive removing one of them", async () => {
    await downloadSetlist(await planDownload("s1"));
    await downloadSetlist(await planDownload("s2"));
    await removeSnapshot("s1");
    expect(await listSnapshots()).toHaveLength(1);
    expect(await fileKeys()).toEqual([offlineKeys.file(A1), offlineKeys.file(A2), offlineKeys.file(D1)].sort());
    // The band row stays: s2 still names it.
    expect(await rawKeys()).toContain(offlineKeys.band(BAND_ID));

    await removeSnapshot("s2");
    expect(await fileKeys()).toEqual([]);
    expect(await rawKeys()).not.toContain(offlineKeys.band(BAND_ID));
  });

  it("counts every user's references: a hidden user's files survive", async () => {
    await seedRaw(snapshotRecords({ userId: USER_B, setlistId: "hidden", bandId: 3 }));
    const orphan = "9/x/orphan.pdf";
    await seedRaw({ [offlineKeys.file(orphan)]: { storagePath: orphan, blob: new Blob(["xy"]), bytes: 2, downloadedAt: "" } });
    setOfflineCurrentUser(null); // session-lost: no current user at all
    expect(await collectGarbage()).toEqual({ deletedFiles: 1, freedBytes: 2 });
    expect(await fileKeys()).toEqual([offlineKeys.file("3/song-hidden/sm-hidden.pdf")]);
    expect((await rawEntries())[offlineKeys.meta]).toMatchObject({ lastGcAt: expect.any(String) });
  });

  it("removeSnapshot ignores another user's snapshot", async () => {
    await seedRaw(snapshotRecords({ userId: USER_B, setlistId: "theirs" }));
    await removeSnapshot("theirs");
    expect(await rawKeys()).toContain(offlineKeys.snapshotMeta("theirs"));
  });
});

// ---------------------------------------------------------------------------
// The races the spec doesn't spell out
// ---------------------------------------------------------------------------

describe("race 1: wipeAll() during a download", () => {
  it("aborts the download and nothing is written after the wipe", async () => {
    server.files[B1] = { bytes: 300, hangAfter: 10 };
    const started = fetchStarted(B1);
    const done = downloadSetlist(await planDownload("s1"));
    await started;
    await wipeAll();
    const result = await done;
    expect(result.state).toBe("cancelled");
    await flush();
    expect(await rawKeys()).toEqual([offlineKeys.meta]);
  });

  it("a wipe right after the call, before the first write, still stops it", async () => {
    const plan = await planDownload("s1");
    const done = downloadSetlist(plan);
    await wipeAll();
    expect((await done).state).toBe("cancelled");
    await flush();
    expect(await rawKeys()).toEqual([offlineKeys.meta]);
    expect(server.fetched).toEqual([]);
  });

  it("a user change (confirmed sign-in of another uid) wipes and stops it the same way", async () => {
    server.files[A2] = { bytes: 20, hangAfter: 0 };
    const started = fetchStarted(A2);
    const done = downloadSetlist(await planDownload("s1"));
    await started;
    expect(await confirmSignedInUser(USER_B)).toEqual({ wiped: true });
    signIn(USER_B);
    expect((await done).state).toBe("cancelled");
    await flush();
    expect(await rawKeys()).toEqual([offlineKeys.lastUser, offlineKeys.meta].sort());
    expect((await rawEntries())[offlineKeys.lastUser]).toBe(USER_B);
  });

  it("a wipe by another tab (new epoch) refuses the in-flight file and journal writes", async () => {
    server.files[A2] = { bytes: 20, hangAfter: 5 };
    const started = fetchStarted(A2);
    const done = downloadSetlist(await planDownload("s1"));
    await started;
    await flush();
    // Another tab's clearStore(): clear + a fresh meta with a new epoch. This
    // tab's in-memory state knows nothing about it.
    const other = createStore(OFFLINE_DB_NAME, OFFLINE_STORE_NAME);
    await other("readwrite", (s) => {
      s.clear();
      s.put({ schemaVersion: OFFLINE_SCHEMA_VERSION, persisted: null, lastGcAt: null, epoch: "other-tab" }, offlineKeys.meta);
      return new Promise<void>((resolve) => (s.transaction.oncomplete = () => resolve()));
    });
    server.release.get(A2)!();
    const result = await done;
    expect(result.state).toBe("cancelled");
    await flush();
    expect(await rawKeys()).toEqual([offlineKeys.meta]);
  });
});

describe("race 2: auth drops mid-download", () => {
  it("session-lost: remaining files are network failures, the journal stays, nothing is committed", async () => {
    server.files[A2] = { bytes: 20, hangAfter: 5 };
    const started = fetchStarted(A2);
    const done = downloadSetlist(await planDownload("s1"));
    await started;
    await flush();
    setOfflineCurrentUser(null); // involuntary SIGNED_OUT → session-lost
    server.release.get(A2)!();
    const result = await done;

    expect(result.state).toBe("failed");
    expect(result.failure?.code).toBe("not-authenticated");
    expect(result.missingFiles.map((m) => [m.storagePath, m.reason])).toEqual([
      [B1, "network"],
      [B2, "network"],
    ]);
    const keys = await rawKeys();
    expect(keys).not.toContain(offlineKeys.snapshotMeta("s1"));
    expect(keys).not.toContain(offlineKeys.snapshot("s1"));
    const journal = await journalOf("s1");
    expect(journal).toMatchObject({ userId: USER_A, outcomes: { [A1]: "stored", [A2]: "stored", [B1]: "network", [B2]: "network" } });
    expect(server.fetched).toEqual([A1, A2]);

    // Same user back with a session: resume completes under the original owner.
    signIn(USER_A);
    const [resumed] = await resumeInterruptedDownloads();
    expect(resumed.meta).toMatchObject({ userId: USER_A, completeness: "complete" });
  });

  it("offline-cached (no valid session, same uid) is reported as offline", async () => {
    server.files[A1] = { bytes: 100, hangAfter: 5 };
    const started = fetchStarted(A1);
    const done = downloadSetlist(await planDownload("s1"));
    await started;
    await flush();
    setOfflineCurrentUser(USER_A, { authenticated: false });
    server.release.get(A1)!();
    const result = await done;
    expect(result.failure?.code).toBe("offline");
    expect(await journalOf("s1")).toBeDefined();
  });

  it("a session that ends during the last file never commits", async () => {
    server.files[B2] = { bytes: 40, hangAfter: 5 };
    const started = fetchStarted(B2);
    const done = downloadSetlist(await planDownload("s1"));
    await started;
    await flush();
    setOfflineCurrentUser(null);
    server.release.get(B2)!();
    const result = await done;
    expect(result.state).toBe("failed");
    expect(result.failure?.code).toBe("not-authenticated");
    expect(await rawKeys()).not.toContain(offlineKeys.snapshotMeta("s1"));
    expect(await journalOf("s1")).toBeDefined();
  });
});

describe("commit is local: no network or valid session needed (race 2)", () => {
  /** Runs s1 until B2 (the last file) is being fetched, then applies `during` and lets B2 finish. */
  async function downloadWithLastFile(during: () => void): Promise<DownloadResult> {
    server.files[B2] = { bytes: 40, hangAfter: 5 };
    const started = fetchStarted(B2);
    const done = downloadSetlist(await planDownload("s1"));
    await started;
    await flush();
    during();
    server.release.get(B2)!();
    return done;
  }

  const goOffline = () => {
    vi.stubGlobal("navigator", { onLine: false, locks: navigator.locks });
    setOfflineCurrentUser(USER_A, { authenticated: false }); // offline-cached
  };

  it("all files stored, device offline before the commit → commits a complete snapshot", async () => {
    const result = await downloadWithLastFile(goOffline);
    expect(result).toMatchObject({ state: "done", meta: { userId: USER_A, completeness: "complete", fileCount: 4 } });
    expect(await journalOf("s1")).toBeUndefined();
    expect(await listSnapshots()).toHaveLength(1);
  });

  it("resume offline with every file already stored → commits without any request", async () => {
    // Session lost during the last file: nothing committed, every file stored.
    const interrupted = await downloadWithLastFile(() => setOfflineCurrentUser(null));
    expect(interrupted.state).toBe("failed");
    expect((await journalOf("s1"))?.outcomes).toEqual({ [A1]: "stored", [A2]: "stored", [B1]: "stored", [B2]: "stored" });

    vi.stubGlobal("navigator", { onLine: false, locks: navigator.locks });
    setOfflineCurrentUser(USER_A, { authenticated: false });
    server.fetched = [];
    vi.mocked(createSheetMusicDownloadUrl).mockClear();
    const [result] = await resumeInterruptedDownloads();
    expect(result).toMatchObject({ state: "done", meta: { userId: USER_A, completeness: "complete" } });
    expect(server.fetched).toEqual([]);
    expect(createSheetMusicDownloadUrl).not.toHaveBeenCalled();
    expect(await journalOf("s1")).toBeUndefined();
  });

  it("another uid current before the commit → nothing committed", async () => {
    const result = await downloadWithLastFile(() => signIn(USER_B));
    expect(result.state).toBe("failed");
    expect(await rawKeys()).not.toContain(offlineKeys.snapshotMeta("s1"));
    expect((await journalOf("s1"))?.userId).toBe(USER_A);
  });
});

describe("one file's network failure does not skip the rest", () => {
  it("file 2 of 4 fails with a network error; files 3–4 still download", async () => {
    const realFetch = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith(A2)) {
          server.fetched.push(A2);
          throw new TypeError("Failed to fetch");
        }
        return realFetch(url, init);
      })
    );
    const result = await downloadSetlist(await planDownload("s1"));
    expect(result.state).toBe("done-with-errors");
    expect(result.missingFiles.map((m) => [m.storagePath, m.reason])).toEqual([[A2, "network"]]);
    expect(server.fetched).toEqual([A1, A2, B1, B2]);
    expect(await fileKeys()).toEqual([A1, B1, B2].map(offlineKeys.file).sort());
  });
});

describe("race 3: collectGarbage while a download is in flight", () => {
  it("never deletes a file the in-flight journal references", async () => {
    // A leftover file the plan counts as present, plus a stored one mid-download.
    await seedRaw({ [offlineKeys.file(B2)]: { storagePath: B2, blob: new Blob(["b2"]), bytes: 2, downloadedAt: "" } });
    server.files[B1] = { bytes: 300, hangAfter: 5 };
    const started = fetchStarted(B1);
    const done = downloadSetlist(await planDownload("s1"));
    await started;
    await flush();
    expect(await collectGarbage()).toEqual({ deletedFiles: 0, freedBytes: 0 });
    server.release.get(B1)!();
    const result = await done;
    expect(result.state).toBe("done");
    expect(await fileKeys()).toEqual([A1, A2, B1, B2].map(offlineKeys.file).sort());
  });

  it("another tab's journal protects its files too", async () => {
    const journal = await makeInterruptedJournal();
    // A different tab's in-memory state is not here: only the journal is.
    resetOfflineTestEnv();
    installServerKeepingState();
    const orphan = "9/x/orphan.pdf";
    await seedRaw({
      ...storeMeta(),
      [offlineKeys.download("s1")]: journal,
      [offlineKeys.file(A1)]: { storagePath: A1, blob: new Blob(["a"]), bytes: 1, downloadedAt: "" },
      [offlineKeys.file(orphan)]: { storagePath: orphan, blob: new Blob(["o"]), bytes: 1, downloadedAt: "" },
    });
    await openOfflineStore();
    expect(await collectGarbage()).toEqual({ deletedFiles: 1, freedBytes: 1 });
    expect(await fileKeys()).toEqual([offlineKeys.file(A1)]);
  });

  it("a present file GC'd between plan and download start is fetched, not assumed", async () => {
    await seedRaw({ [offlineKeys.file(A1)]: { storagePath: A1, blob: new Blob(["a"]), bytes: 1, downloadedAt: "" } });
    const plan = await planDownload("s1");
    expect(plan.filesAlreadyPresent.map((f) => f.storagePath)).toEqual([A1]);
    // Nothing references A1 yet (no journal): a GC now reclaims it.
    expect((await collectGarbage()).deletedFiles).toBe(1);
    const result = await downloadSetlist(plan);
    expect(result.state).toBe("done");
    expect(server.fetched).toEqual([A1, A2, B1, B2]);
    expect(result.meta?.fileCount).toBe(4);
  });
});

describe("persistence and usage", () => {
  it("requestPersistence records the answer; the first download asks once", async () => {
    const persist = vi.fn(async () => true);
    const realNavigator = globalThis.navigator;
    vi.stubGlobal("navigator", {
      locks: realNavigator.locks,
      storage: { persist, estimate: async () => ({ usage: 1000, quota: 10_000 }) },
    });
    const plan = await planDownload("s1");
    expect(plan.estimate).toEqual({ usage: 1000, quota: 10_000 });
    await downloadSetlist(plan);
    await flush();
    expect(persist).toHaveBeenCalledTimes(1);
    expect((await rawEntries())[offlineKeys.meta]).toMatchObject({ persisted: true });
    await downloadSetlist(await planDownload("s2"));
    await flush();
    expect(persist).toHaveBeenCalledTimes(1);
    expect(await requestPersistence()).toBe(true);

    const usage = await getStorageUsage();
    expect(usage).toMatchObject({ usage: 1000, quota: 10_000, persisted: true, distinctFileBytes: 510 });
    expect(usage.bySetlist.sort((a, b) => a.setlistId.localeCompare(b.setlistId))).toEqual([
      { setlistId: "s1", bytes: 460 },
      { setlistId: "s2", bytes: 170 },
    ]);
  });

  it("requestPersistence is null when unsupported", async () => {
    vi.stubGlobal("navigator", {});
    expect(await requestPersistence()).toBeNull();
  });
});

describe("re-download keeps offline preference overrides (§5.6)", () => {
  it("carries localPreferenceOverrides of the same owner", async () => {
    await downloadSetlist(await planDownload("s1"));
    const snapshot = (await rawEntries())[offlineKeys.snapshot("s1")] as Record<string, unknown>;
    await seedRaw({ [offlineKeys.snapshot("s1")]: { ...snapshot, localPreferenceOverrides: { b: "b2" } } });
    const result: DownloadResult = await downloadSetlist(await planDownload("s1"));
    expect(result.state).toBe("done");
    expect((await getSnapshot("s1"))?.localPreferenceOverrides).toEqual({ b: "b2" });
  });
});
