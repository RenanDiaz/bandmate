import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../setlistsService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../setlistsService")>()),
  getSetlist: vi.fn(),
  getSetlistFingerprintRows: vi.fn(),
}));
vi.mock("../songsService", () => ({ getSongsByIds: vi.fn(), getSongTimestamps: vi.fn() }));
vi.mock("../songSheetMusicService", () => ({ getSheetMusicForSongs: vi.fn(), getSheetMusicFingerprintRows: vi.fn() }));
vi.mock("../sheetMusicPreferencesService", () => ({
  getMySheetMusicPreferences: vi.fn(),
  getPreferredInstrument: vi.fn(() => null),
  setMySheetMusicPreference: vi.fn(),
}));
vi.mock("../bandsService", () => ({ getMyBands: vi.fn() }));
vi.mock("../sheetMusicStorageService", () => ({
  createSheetMusicDownloadUrl: vi.fn(),
  listSheetMusicFolderSizes: vi.fn(),
}));

import { getSetlist, getSetlistFingerprintRows, normalizeSetlistItems } from "../setlistsService";
import type { Setlist } from "../setlistsService";
import { getSongTimestamps, getSongsByIds } from "../songsService";
import { getSheetMusicFingerprintRows, getSheetMusicForSongs } from "../songSheetMusicService";
import { getMySheetMusicPreferences } from "../sheetMusicPreferencesService";
import { getMyBands } from "../bandsService";
import { createSheetMusicDownloadUrl, listSheetMusicFolderSizes } from "../sheetMusicStorageService";
import {
  checkForUpdates,
  confirmSignedInUser,
  getSnapshot,
  getSnapshotMeta,
  openOfflineStore,
  setOfflineCurrentUser,
  verifySnapshot,
} from "../offlineSetlistService";
import { offlineKeys } from "../../lib/offlineStore";
import { band, rawKeys, resetOfflineTestEnv, seedRaw } from "../../test/offlineFixtures";
import {
  BAND_ID,
  USER,
  groupSheetMusic,
  items,
  performSnapshotRecords,
  serverRows,
  setlistRow,
  sheet,
  song,
  type ServerRows,
} from "../../test/performFixtures";

/**
 * PR 3.1 (spec §5.3, §6.1, §6.3, §6.5; ACs D1–D6, E2b): the update check and
 * verify. The server is `server` (setlist "s1") plus `extraSetlists`; the
 * snapshot starts with an empty fingerprint, so the first check always
 * refreshes rows and records a real one.
 */

let server: ServerRows;
let extraSetlists: Setlist[];

const allSetlists = () => [server.setlist, ...extraSetlists];

function installServer(): void {
  server = serverRows();
  server.songs = [
    { ...song("a"), updated_at: "2026-04-01T00:00:00Z" },
    { ...song("b"), updated_at: "2026-04-01T00:00:00Z" },
  ];
  extraSetlists = [];
  vi.mocked(getSetlist).mockImplementation(async (id) => {
    const row = allSetlists().find((s) => s.id === id);
    if (!row) throw Object.assign(new Error("not found"), { code: "PGRST116" });
    const copy = structuredClone(row);
    return { ...copy, songs: normalizeSetlistItems(copy.songs) };
  });
  vi.mocked(getSetlistFingerprintRows).mockImplementation(async (ids) =>
    allSetlists()
      .filter((s) => ids.includes(s.id))
      .map((s) => ({ id: s.id, updated_at: s.updated_at, songs: structuredClone(s.songs) }))
  );
  vi.mocked(getSongsByIds).mockImplementation(async (ids) => structuredClone(server.songs.filter((s) => ids.includes(s.id))));
  vi.mocked(getSongTimestamps).mockImplementation(async (ids) =>
    server.songs.filter((s) => ids.includes(s.id)).map((s) => ({ id: s.id, updated_at: s.updated_at ?? "" }))
  );
  vi.mocked(getSheetMusicForSongs).mockImplementation(async (ids) => groupSheetMusic(structuredClone(server.sheetMusic), ids));
  vi.mocked(getSheetMusicFingerprintRows).mockImplementation(async (ids) =>
    server.sheetMusic
      .filter((sm) => ids.includes(sm.song_id))
      .map((sm) => ({ id: sm.id, song_id: sm.song_id, updated_at: sm.updated_at, file_url: sm.file_url }))
  );
  vi.mocked(getMySheetMusicPreferences).mockImplementation(async () => ({ ...server.preferences }));
  vi.mocked(getMyBands).mockImplementation(async () => [band(BAND_ID)]);
}

/** Brings the snapshot's fingerprint in line with the server (first check refreshes rows). */
async function settle(): Promise<void> {
  await checkForUpdates();
  vi.mocked(getSetlist).mockClear();
  vi.mocked(getSongsByIds).mockClear();
  vi.mocked(getSetlistFingerprintRows).mockClear();
  vi.mocked(getSongTimestamps).mockClear();
  vi.mocked(getSheetMusicFingerprintRows).mockClear();
}

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  resetOfflineTestEnv();
  installServer();
  await openOfflineStore();
  await confirmSignedInUser(USER);
  setOfflineCurrentUser(USER, { authenticated: true });
  await seedRaw(performSnapshotRecords());
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("checkForUpdates: fingerprint", () => {
  it("a stale stored fingerprint refreshes rows once and records the server's", async () => {
    const results = await checkForUpdates();
    expect(results.s1).toMatchObject({ status: "fresh" });
    expect(getSetlist).toHaveBeenCalledTimes(1);
    const meta = await getSnapshotMeta("s1");
    expect(meta?.fingerprint.songs).toEqual([
      ["a", "2026-04-01T00:00:00Z"],
      ["b", "2026-04-01T00:00:00Z"],
    ]);
    expect(meta?.fingerprint.sheetMusic.map((t) => t[0])).toEqual(["a1", "a2", "b1"]);
  });

  it("D1: unchanged → fresh with the three cheap queries only", async () => {
    await settle();
    const results = await checkForUpdates();
    expect(results.s1).toMatchObject({ status: "fresh" });
    expect(getSetlistFingerprintRows).toHaveBeenCalledTimes(1);
    expect(getSongTimestamps).toHaveBeenCalledTimes(1);
    expect(getSheetMusicFingerprintRows).toHaveBeenCalledTimes(1);
    expect(getSetlist).not.toHaveBeenCalled();
    expect(getSongsByIds).not.toHaveBeenCalled();
    const meta = await getSnapshotMeta("s1");
    expect(meta?.freshness).toBe("fresh");
    expect(meta?.lastCheckedAt).toBeTruthy();
  });

  it("D2b: a reorder refreshes rows, stays fresh, and the new order is stored", async () => {
    await settle();
    const [a, brk, b] = items();
    server.setlist = setlistRow([{ ...b, position: 0 }, { ...brk, position: 1 }, { ...a, position: 2 }], {
      updated_at: "2026-09-29T12:00:00Z",
    });
    const results = await checkForUpdates();
    expect(results.s1).toMatchObject({ status: "fresh" });
    const meta = await getSnapshotMeta("s1");
    expect(meta?.lastDiff?.applied.setlistChanged).toBe(true);
    expect(meta?.lastDiff?.filesToDownload).toEqual([]);
    const snapshot = await getSnapshot("s1");
    expect(snapshot?.setlist.songs.map((i) => ("song_id" in i ? i.song_id : i.id))).toEqual(["b", "brk-1", "a"]);
  });

  it("D3: a lyrics edit is in the snapshot and in songsChanged; stays fresh", async () => {
    await settle();
    server.songs[0] = { ...server.songs[0], lyrics: "new words", updated_at: "2026-09-29T12:00:00Z" };
    const results = await checkForUpdates();
    expect(results.s1).toMatchObject({ status: "fresh" });
    const meta = await getSnapshotMeta("s1");
    expect(meta?.lastDiff?.applied).toMatchObject({ songsChanged: ["a"], songsAdded: [], songsRemoved: [], setlistChanged: false });
    expect((await getSnapshot("s1"))?.songsById.a.lyrics).toBe("new words");
  });

  it("D2: a new PDF → outdated, the diff lists that file, no /storage/ request", async () => {
    await settle();
    server.sheetMusic.push(sheet("b2", "b", 1));
    const results = await checkForUpdates();
    expect(results.s1.status).toBe("outdated");
    if (results.s1.status !== "outdated") return;
    expect(results.s1.diff.filesToDownload.map((f) => f.sheetMusicId)).toEqual(["b2"]);
    expect(results.s1.diff.applied.sheetMusicAdded).toEqual(["b2"]);
    const meta = await getSnapshotMeta("s1");
    expect(meta?.freshness).toBe("outdated");
    expect(meta?.lastDiff?.filesToDownload.map((f) => f.sheetMusicId)).toEqual(["b2"]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(createSheetMusicDownloadUrl).not.toHaveBeenCalled();
    expect(listSheetMusicFolderSizes).not.toHaveBeenCalled();
    // A later unchanged check keeps it outdated without refetching rows.
    vi.mocked(getSetlist).mockClear();
    expect((await checkForUpdates()).s1.status).toBe("outdated");
    expect(getSetlist).not.toHaveBeenCalled();
  });

  it("D4: a deleted PDF leaves the snapshot, its file is collected, stays fresh", async () => {
    await settle();
    const removed = server.sheetMusic.find((sm) => sm.id === "a2")!;
    server.sheetMusic = server.sheetMusic.filter((sm) => sm.id !== "a2");
    const results = await checkForUpdates();
    expect(results.s1).toMatchObject({ status: "fresh" });
    const meta = await getSnapshotMeta("s1");
    expect(meta?.lastDiff?.applied.sheetMusicRemoved).toEqual(["a2"]);
    expect(meta?.lastDiff?.filesReleased.map((f) => f.sheetMusicId)).toEqual(["a2"]);
    expect((await getSnapshot("s1"))?.sheetMusicBySongId.a.map((sm) => sm.id)).toEqual(["a1"]);
    expect(await rawKeys()).not.toContain(offlineKeys.file(removed.file_url));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(listSheetMusicFolderSizes).not.toHaveBeenCalled();
  });

  it("E2b: a renamed PDF refreshes its row in place and keeps the file", async () => {
    await settle();
    server.sheetMusic[0] = { ...server.sheetMusic[0], name: "Renamed", updated_at: "2026-09-29T12:00:00Z" };
    const results = await checkForUpdates();
    expect(results.s1).toMatchObject({ status: "fresh" });
    const meta = await getSnapshotMeta("s1");
    expect(meta?.lastDiff?.applied.sheetMusicChanged).toEqual(["a1"]);
    expect(meta?.lastDiff?.filesToDownload).toEqual([]);
    expect((await getSnapshot("s1"))?.sheetMusicBySongId.a[0].name).toBe("Renamed");
    expect(await rawKeys()).toContain(offlineKeys.file(server.sheetMusic[0].file_url));
  });

  it("D5: a deleted setlist → deleted, rows kept", async () => {
    await settle();
    server.setlist = { ...server.setlist, id: "gone" };
    const results = await checkForUpdates();
    expect(results.s1).toMatchObject({ status: "deleted" });
    expect((await getSnapshotMeta("s1"))?.freshness).toBe("deleted");
    expect((await getSnapshot("s1"))?.setlist.name).toBe("Friday");
  });

  it("a deleted setlist that comes back (access regained) is fresh again", async () => {
    await settle();
    const original = server.setlist;
    server.setlist = { ...server.setlist, id: "gone" };
    await checkForUpdates();
    server.setlist = original;
    expect((await checkForUpdates()).s1).toMatchObject({ status: "fresh" });
  });
});

describe("checkForUpdates: when it does not run", () => {
  it("D6: offline → unknown/offline, no query, nothing written", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const before = await getSnapshotMeta("s1");
    const results = await checkForUpdates();
    expect(results.s1).toMatchObject({ status: "unknown", reason: "offline" });
    expect(getSetlistFingerprintRows).not.toHaveBeenCalled();
    expect(await getSnapshotMeta("s1")).toEqual(before);
  });

  it("a network error → unknown/offline, nothing written", async () => {
    vi.mocked(getSetlistFingerprintRows).mockRejectedValue(new TypeError("Failed to fetch"));
    const before = await getSnapshotMeta("s1");
    expect((await checkForUpdates()).s1).toMatchObject({ status: "unknown", reason: "offline" });
    expect(await getSnapshotMeta("s1")).toEqual(before);
  });

  it("an HTTP error → unknown/error", async () => {
    vi.mocked(getSongTimestamps).mockRejectedValue(Object.assign(new Error("boom"), { code: "500" }));
    expect((await checkForUpdates()).s1).toMatchObject({ status: "unknown", reason: "error" });
  });

  it("rejects without a valid session (offline-cached)", async () => {
    setOfflineCurrentUser(USER, { authenticated: false });
    await expect(checkForUpdates()).rejects.toMatchObject({ code: "not-authenticated" });
  });

  it("no snapshots → no request", async () => {
    await checkForUpdates(["other"]);
    expect(getSetlistFingerprintRows).not.toHaveBeenCalled();
  });
});

describe("checkForUpdates: batching", () => {
  it("checks every snapshot with one query of each kind", async () => {
    const second: ServerRows = { ...serverRows(), setlist: setlistRow(items(), { id: "s2", name: "Saturday" }) };
    second.songs = server.songs;
    extraSetlists = [second.setlist];
    await seedRaw(performSnapshotRecords(second));
    await settle();
    const results = await checkForUpdates();
    expect(Object.keys(results).sort()).toEqual(["s1", "s2"]);
    expect(getSetlistFingerprintRows).toHaveBeenCalledTimes(1);
    expect(vi.mocked(getSetlistFingerprintRows).mock.calls[0][0].sort()).toEqual(["s1", "s2"]);
    expect(getSongTimestamps).toHaveBeenCalledTimes(1);
    expect(getSheetMusicFingerprintRows).toHaveBeenCalledTimes(1);
  });

  it("overlapping checks share one run", async () => {
    await settle();
    const [first, second, subset] = await Promise.all([checkForUpdates(), checkForUpdates(), checkForUpdates(["s1"])]);
    expect(first).toBe(second);
    expect(subset.s1).toMatchObject({ status: "fresh" });
    expect(getSetlistFingerprintRows).toHaveBeenCalledTimes(1);
  });
});

describe("verifySnapshot (§6.5)", () => {
  it("F2: every file reads back → ok and verifiedAt", async () => {
    const result = await verifySnapshot("s1");
    expect(result).toEqual({ ok: true, missing: [] });
    const meta = await getSnapshotMeta("s1");
    expect(meta?.verifiedAt).toBeTruthy();
    expect(meta?.completeness).toBe("complete");
  });

  it("a file whose blob is shorter than recorded → partial, listed, deleted online", async () => {
    const path = server.sheetMusic[1].file_url;
    await seedRaw({
      [offlineKeys.file(path)]: { storagePath: path, blob: new Blob([]), bytes: 4, downloadedAt: "2026-09-20T10:00:00.000Z" },
    });
    const result = await verifySnapshot("s1");
    expect(result.ok).toBe(false);
    expect(result.missing.map((m) => m.sheetMusicId)).toEqual(["a2"]);
    const meta = await getSnapshotMeta("s1");
    expect(meta?.completeness).toBe("partial");
    expect(meta?.verifiedAt).toBeNull();
    expect(meta?.fileCount).toBe(2);
    expect(await rawKeys()).not.toContain(offlineKeys.file(path));
  });

  it("offline, a bad file is recorded but its record is kept", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const path = server.sheetMusic[1].file_url;
    await seedRaw({
      [offlineKeys.file(path)]: { storagePath: path, blob: new Blob([]), bytes: 4, downloadedAt: "2026-09-20T10:00:00.000Z" },
    });
    expect((await verifySnapshot("s1")).ok).toBe(false);
    expect(await rawKeys()).toContain(offlineKeys.file(path));
  });

  it("a snapshot that already has failed files is not verified", async () => {
    await seedRaw(performSnapshotRecords(serverRows(), { stored: ["a1", "b1"], missingReason: "quota" }));
    const result = await verifySnapshot("s1");
    expect(result.ok).toBe(false);
    expect(result.missing.map((m) => m.reason)).toEqual(["quota"]);
    expect((await getSnapshotMeta("s1"))?.verifiedAt).toBeNull();
  });

  it("a not-downloaded file (outdated) does not fail verification", async () => {
    await settle();
    server.sheetMusic.push(sheet("b2", "b", 1));
    await checkForUpdates();
    expect(await verifySnapshot("s1")).toEqual({ ok: true, missing: [] });
  });

  it("no snapshot → not ok, nothing written", async () => {
    expect(await verifySnapshot("nope")).toEqual({ ok: false, missing: [] });
  });
});
