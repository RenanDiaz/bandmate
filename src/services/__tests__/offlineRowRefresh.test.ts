import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../setlistsService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../setlistsService")>()),
  getSetlist: vi.fn(),
}));
vi.mock("../songsService", () => ({ getSongsByIds: vi.fn() }));
vi.mock("../songSheetMusicService", () => ({ getSheetMusicForSongs: vi.fn() }));
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

import { getSetlist, normalizeSetlistItems } from "../setlistsService";
import { getSongsByIds } from "../songsService";
import { getSheetMusicForSongs } from "../songSheetMusicService";
import { getMySheetMusicPreferences, setMySheetMusicPreference } from "../sheetMusicPreferencesService";
import { getMyBands } from "../bandsService";
import {
  confirmSignedInUser,
  flushLocalPreferences,
  getSnapshot,
  getSnapshotMeta,
  markSnapshotFileMissing,
  openOfflineStore,
  patchSnapshotPreference,
  patchSnapshotSetlist,
  recordLocalPreference,
  refreshSnapshotRows,
  setOfflineCurrentUser,
  subscribe,
} from "../offlineSetlistService";
import type { OfflineEvent } from "../offlineSetlistService";
import { offlineKeys } from "../../lib/offlineStore";
import { band, rawKeys, resetOfflineTestEnv, seedRaw } from "../../test/offlineFixtures";
import {
  BAND_ID,
  USER,
  groupSheetMusic,
  performSnapshotRecords,
  serverRows,
  setlistRow,
  sheet,
  type ServerRows,
} from "../../test/performFixtures";

let server: ServerRows;

function installServer(): void {
  server = serverRows();
  vi.mocked(getSetlist).mockImplementation(async (id) => {
    if (id !== server.setlist.id) throw Object.assign(new Error("not found"), { code: "PGRST116" });
    const row = structuredClone(server.setlist);
    return { ...row, songs: normalizeSetlistItems(row.songs) };
  });
  vi.mocked(getSongsByIds).mockImplementation(async (ids) => structuredClone(server.songs.filter((s) => ids.includes(s.id))));
  vi.mocked(getSheetMusicForSongs).mockImplementation(async (ids) => groupSheetMusic(structuredClone(server.sheetMusic), ids));
  vi.mocked(getMySheetMusicPreferences).mockImplementation(async () => ({ ...server.preferences }));
  vi.mocked(getMyBands).mockImplementation(async () => [band(BAND_ID)]);
  vi.mocked(setMySheetMusicPreference).mockReset();
  vi.mocked(setMySheetMusicPreference).mockResolvedValue(undefined);
}

beforeEach(async () => {
  resetOfflineTestEnv();
  installServer();
  await openOfflineStore();
  await confirmSignedInUser(USER);
  setOfflineCurrentUser(USER, { authenticated: true });
  await seedRaw(performSnapshotRecords());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("refreshSnapshotRows (A3)", () => {
  it("unchanged rows: nothing rewritten but the check, freshness fresh", async () => {
    const before = await getSnapshot("s1");
    const result = await refreshSnapshotRows("s1");
    expect(result).toEqual({ status: "unchanged", filesNotDownloaded: [], filesReleased: [] });
    expect(await getSnapshot("s1")).toEqual(before);
    const meta = await getSnapshotMeta("s1");
    expect(meta).toMatchObject({ freshness: "fresh", rowsUpdatedAt: "2026-09-20T10:00:00.000Z" });
    expect(meta?.lastCheckedAt).not.toBeNull();
  });

  it("a special item the server never saved with an id keeps the snapshot's id (no false change)", async () => {
    server.setlist = setlistRow([
      { type: "song", song_id: "a", position: 0 },
      { type: "break", label: "Break", position: 1 } as never,
      { type: "song", song_id: "b", position: 2 },
    ]);
    expect((await refreshSnapshotRows("s1")).status).toBe("unchanged");
  });

  it("a bandmate's reorder is committed, with no file fetched (B11)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const events: OfflineEvent[] = [];
    subscribe((e) => events.push(e));
    server.setlist = setlistRow([
      { type: "song", song_id: "b", position: 0 },
      { type: "break", id: "brk-1", label: "Break", position: 1 },
      { type: "song", song_id: "a", position: 2 },
    ], { updated_at: "2026-09-21T00:00:00Z" });

    const result = await refreshSnapshotRows("s1");
    expect(result.status).toBe("updated");
    const snapshot = await getSnapshot("s1");
    expect(snapshot?.setlist.songs.map((i) => ("song_id" in i ? i.song_id : i.id))).toEqual(["b", "brk-1", "a"]);
    const meta = await getSnapshotMeta("s1");
    expect(meta).toMatchObject({ freshness: "fresh", completeness: "complete" });
    expect(meta?.rowsUpdatedAt).not.toBe("2026-09-20T10:00:00.000Z");
    expect(meta?.fingerprint.setlistUpdatedAt).toBe("2026-09-21T00:00:00Z");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(events).toContainEqual({ type: "snapshot-changed", setlistId: "s1" });
  });

  it("a new PDF becomes 'not-downloaded' and the snapshot 'outdated'; no download (B13)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    server.sheetMusic.push(sheet("b2", "b", 1));
    const result = await refreshSnapshotRows("s1");
    expect(result.status).toBe("updated");
    expect(result.filesNotDownloaded.map((f) => f.sheetMusicId)).toEqual(["b2"]);
    const meta = await getSnapshotMeta("s1");
    expect(meta).toMatchObject({ freshness: "outdated", completeness: "complete" });
    expect(meta?.missingFiles).toEqual([expect.objectContaining({ sheetMusicId: "b2", reason: "not-downloaded" })]);
    expect((await getSnapshot("s1"))?.sheetMusicBySongId.b.map((sm) => sm.id)).toEqual(["b1", "b2"]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("a removed PDF is released and its file garbage-collected", async () => {
    server.sheetMusic = server.sheetMusic.filter((sm) => sm.id !== "a1");
    const result = await refreshSnapshotRows("s1");
    expect(result.filesReleased.map((f) => f.sheetMusicId)).toEqual(["a1"]);
    expect(await rawKeys()).not.toContain(offlineKeys.file(`${BAND_ID}/a/a1.pdf`));
    expect(await rawKeys()).toContain(offlineKeys.file(`${BAND_ID}/a/a2.pdf`));
  });

  it("a failed download reason survives the refresh (still partial)", async () => {
    resetOfflineTestEnv();
    await openOfflineStore();
    await confirmSignedInUser(USER);
    setOfflineCurrentUser(USER, { authenticated: true });
    await seedRaw(performSnapshotRecords(serverRows(), { stored: ["a1", "b1"], missingReason: "quota" }));
    await refreshSnapshotRows("s1");
    expect(await getSnapshotMeta("s1")).toMatchObject({
      completeness: "partial",
      freshness: "fresh",
      missingFiles: [expect.objectContaining({ sheetMusicId: "a2", reason: "quota" })],
    });
  });

  it("keeps local overrides over refreshed server preferences (§5.6)", async () => {
    await recordLocalPreference("s1", "a", "a1");
    server.preferences = { a: "a2", b: "b1" };
    server.setlist = { ...server.setlist, name: "Friday late" };
    await refreshSnapshotRows("s1");
    const snapshot = await getSnapshot("s1");
    expect(snapshot?.preferredSheetMusicIds).toEqual({ a: "a2", b: "b1" });
    expect(snapshot?.localPreferenceOverrides).toEqual({ a: "a1" });
  });

  it("deleted on the server → freshness 'deleted', rows kept (D5)", async () => {
    server.setlist = { ...server.setlist, id: "other" };
    expect((await refreshSnapshotRows("s1")).status).toBe("deleted");
    expect(await getSnapshotMeta("s1")).toMatchObject({ freshness: "deleted" });
    expect((await getSnapshot("s1"))?.setlist.name).toBe("Friday");
  });

  it("a network failure writes nothing", async () => {
    const before = await getSnapshotMeta("s1");
    vi.mocked(getSongsByIds).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect((await refreshSnapshotRows("s1")).status).toBe("failed");
    expect(await getSnapshotMeta("s1")).toEqual(before);
  });

  it("browser offline → failed without a request", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect((await refreshSnapshotRows("s1")).status).toBe("failed");
    expect(getSetlist).not.toHaveBeenCalled();
  });

  it("skipped while a download journal of the setlist exists (§4.3)", async () => {
    await seedRaw({ [offlineKeys.download("s1")]: { schemaVersion: 1, setlistId: "s1", userId: USER } });
    expect((await refreshSnapshotRows("s1")).status).toBe("skipped");
    expect(getSetlist).not.toHaveBeenCalled();
  });

  it("skipped without a snapshot; rejects not-authenticated without a session", async () => {
    expect((await refreshSnapshotRows("nope")).status).toBe("skipped");
    setOfflineCurrentUser(USER, { authenticated: false });
    await expect(refreshSnapshotRows("s1")).rejects.toMatchObject({ code: "not-authenticated" });
  });
});

describe("perform-mode write-through", () => {
  it("patchSnapshotSetlist replaces the row, normalized, and moves the fingerprint", async () => {
    const reordered = setlistRow(
      [
        { type: "song", song_id: "b", position: 0 },
        { type: "song", song_id: "a", position: 1 },
        { type: "break", label: "Break", position: 2 } as never,
      ],
      { updated_at: "2026-09-22T00:00:00Z" }
    );
    await patchSnapshotSetlist("s1", reordered);
    const snapshot = await getSnapshot("s1");
    expect(snapshot?.setlist.songs.map((i) => i.type)).toEqual(["song", "song", "break"]);
    expect(snapshot?.setlist.songs[2].id).toBeTruthy(); // normalized
    const meta = await getSnapshotMeta("s1");
    expect(meta?.fingerprint.setlistUpdatedAt).toBe("2026-09-22T00:00:00Z");
    expect(meta?.fingerprint.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("patchSnapshotPreference records the choice and drops that song's override", async () => {
    await recordLocalPreference("s1", "a", "a1");
    await recordLocalPreference("s1", "b", "b1");
    await patchSnapshotPreference("s1", "a", "a1");
    const snapshot = await getSnapshot("s1");
    expect(snapshot?.preferredSheetMusicIds.a).toBe("a1");
    expect(snapshot?.localPreferenceOverrides).toEqual({ b: "b1" });
  });

  it("patches are no-ops without a snapshot or for another user, and never reject", async () => {
    await expect(patchSnapshotSetlist("nope", setlistRow())).resolves.toBeUndefined();
    setOfflineCurrentUser("user-b", { authenticated: true });
    await patchSnapshotPreference("s1", "a", "a1");
    setOfflineCurrentUser(USER, { authenticated: true });
    expect((await getSnapshot("s1"))?.preferredSheetMusicIds.a).toBe("a2");
  });
});

describe("offline preferences (§5.6)", () => {
  it("recordLocalPreference works with no session and no network (B6)", async () => {
    setOfflineCurrentUser(USER, { authenticated: false }); // offline-cached
    vi.stubGlobal("navigator", { onLine: false });
    await recordLocalPreference("s1", "a", "a1");
    expect((await getSnapshot("s1"))?.localPreferenceOverrides).toEqual({ a: "a1" });
    expect(setMySheetMusicPreference).not.toHaveBeenCalled();
  });

  it("flushLocalPreferences pushes overrides, then moves them into the server preferences", async () => {
    await recordLocalPreference("s1", "a", "a1");
    await recordLocalPreference("s1", "b", "b1");
    await flushLocalPreferences("s1");
    expect(setMySheetMusicPreference).toHaveBeenCalledWith("a", "a1");
    expect(setMySheetMusicPreference).toHaveBeenCalledWith("b", "b1");
    const snapshot = await getSnapshot("s1");
    expect(snapshot?.localPreferenceOverrides).toEqual({});
    expect(snapshot?.preferredSheetMusicIds).toMatchObject({ a: "a1", b: "b1" });
  });

  it("a failed flush keeps the override for the next attempt, and never rejects", async () => {
    await recordLocalPreference("s1", "a", "a1");
    vi.mocked(setMySheetMusicPreference).mockRejectedValueOnce(new Error("500"));
    await expect(flushLocalPreferences("s1")).resolves.toBeUndefined();
    expect((await getSnapshot("s1"))?.localPreferenceOverrides).toEqual({ a: "a1" });
  });

  it("does nothing without a session or offline", async () => {
    await recordLocalPreference("s1", "a", "a1");
    setOfflineCurrentUser(USER, { authenticated: false });
    await flushLocalPreferences("s1");
    setOfflineCurrentUser(USER, { authenticated: true });
    vi.stubGlobal("navigator", { onLine: false });
    await flushLocalPreferences("s1");
    expect(setMySheetMusicPreference).not.toHaveBeenCalled();
  });
});

describe("markSnapshotFileMissing (§9.3)", () => {
  const A1 = `${BAND_ID}/a/a1.pdf`;

  it("records the file as missing; the key stays unless deleteFile", async () => {
    await markSnapshotFileMissing("s1", A1);
    expect(await getSnapshotMeta("s1")).toMatchObject({
      completeness: "partial",
      missingFiles: [expect.objectContaining({ sheetMusicId: "a1", reason: "unknown" })],
    });
    expect(await rawKeys()).toContain(offlineKeys.file(A1));
  });

  it("deleteFile removes the file key so Retry fetches it again", async () => {
    await markSnapshotFileMissing("s1", A1, { deleteFile: true });
    expect(await rawKeys()).not.toContain(offlineKeys.file(A1));
  });
});
