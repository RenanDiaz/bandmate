import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/setlistsService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/setlistsService")>()),
  getSetlist: vi.fn(),
  updateSetlist: vi.fn(),
}));
vi.mock("../../services/songsService", () => ({ getSongsByIds: vi.fn() }));
vi.mock("../../services/songSheetMusicService", () => ({ getSheetMusicForSongs: vi.fn() }));
vi.mock("../../services/sheetMusicPreferencesService", () => ({
  getMySheetMusicPreferences: vi.fn(),
  getPreferredInstrument: vi.fn(() => null),
  setPreferredInstrument: vi.fn(),
  setMySheetMusicPreference: vi.fn(),
}));
vi.mock("../../services/bandsService", () => ({ getMyBands: vi.fn() }));
vi.mock("../../services/sheetMusicStorageService", () => ({
  createSheetMusicDownloadUrl: vi.fn(),
  listSheetMusicFolderSizes: vi.fn(),
}));

import { getSetlist, normalizeSetlistItems, updateSetlist } from "../../services/setlistsService";
import type { SetlistItem } from "../../services/setlistsService";
import { getSongsByIds } from "../../services/songsService";
import { getSheetMusicForSongs } from "../../services/songSheetMusicService";
import { getMySheetMusicPreferences, setMySheetMusicPreference } from "../../services/sheetMusicPreferencesService";
import { getMyBands } from "../../services/bandsService";
import {
  confirmSignedInUser,
  getSnapshot,
  getSnapshotMeta,
  openOfflineStore,
  setOfflineCurrentUser,
} from "../../services/offlineSetlistService";
import { offlineKeys } from "../../lib/offlineStore";
import { band, flush, rawKeys, resetOfflineTestEnv, seedRaw } from "../../test/offlineFixtures";
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
import { createSnapshotPerformanceDataSource, shareRows } from "../snapshotPerformanceDataSource";
import { NoSnapshotError, PdfUnavailableError } from "../performanceDataSource";
import type { PerformanceRows, PerformanceSession } from "../performanceDataSource";

let server: ServerRows;
let online: boolean;
let reportNetworkFailure: ReturnType<typeof vi.fn<() => void>>;
let created: string[];
let revoked: string[];

const A1 = sheet("a1", "a", 0);
const A2 = sheet("a2", "a", 1);

function installServer(): void {
  server = serverRows();
  vi.mocked(getSetlist).mockImplementation(async () => {
    const row = structuredClone(server.setlist);
    return { ...row, songs: normalizeSetlistItems(row.songs) };
  });
  vi.mocked(getSongsByIds).mockImplementation(async (ids) => structuredClone(server.songs.filter((s) => ids.includes(s.id))));
  vi.mocked(getSheetMusicForSongs).mockImplementation(async (ids) => groupSheetMusic(structuredClone(server.sheetMusic), ids));
  vi.mocked(getMySheetMusicPreferences).mockImplementation(async () => ({ ...server.preferences }));
  vi.mocked(getMyBands).mockImplementation(async () => [band(BAND_ID)]);
  vi.mocked(setMySheetMusicPreference).mockReset();
  vi.mocked(setMySheetMusicPreference).mockImplementation(async (songId, id) => {
    server.preferences[songId] = id;
  });
  vi.mocked(updateSetlist).mockReset();
  vi.mocked(updateSetlist).mockImplementation(async (_id, updates) => {
    server.setlist = { ...server.setlist, songs: updates.songs ?? server.setlist.songs, updated_at: "2026-09-25T12:00:00Z" };
    return structuredClone(server.setlist);
  });
}

function open(): PerformanceSession {
  let n = 0;
  const source = createSnapshotPerformanceDataSource({
    isOnline: () => online,
    reportNetworkFailure,
    createObjectURL: () => {
      const url = `blob:test/${++n}`;
      created.push(url);
      return url;
    },
    revokeObjectURL: (url) => revoked.push(url),
  });
  return source.open("s1");
}

async function signIn(authenticated = true): Promise<void> {
  await confirmSignedInUser(USER);
  setOfflineCurrentUser(USER, { authenticated });
}

beforeEach(async () => {
  resetOfflineTestEnv();
  installServer();
  online = false;
  reportNetworkFailure = vi.fn<() => void>();
  created = [];
  revoked = [];
  await openOfflineStore();
  await signIn();
  await seedRaw(performSnapshotRecords());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("snapshot source: load", () => {
  it("renders the snapshot rows, overrides on top, with no network call offline", async () => {
    await seedRaw(performSnapshotRecords(serverRows(), { localPreferenceOverrides: { b: "b1" } }));
    const rows = await open().load(new AbortController().signal);
    expect(rows.setlist.name).toBe("Friday");
    expect(Object.keys(rows.songsById).sort()).toEqual(["a", "b"]);
    expect(rows.preferredSheetMusicIds).toEqual({ a: "a2", b: "b1" });
    expect(rows.unavailableSheetMusicIds?.size).toBe(0);
    await flush();
    expect(getSetlist).not.toHaveBeenCalled();
  });

  it("rejects with NoSnapshotError without a snapshot for this user", async () => {
    setOfflineCurrentUser("user-b", { authenticated: true });
    await expect(open().load(new AbortController().signal)).rejects.toBeInstanceOf(NoSnapshotError);
  });

  it("works in offline-cached (no session)", async () => {
    setOfflineCurrentUser(USER, { authenticated: false });
    await expect(open().load(new AbortController().signal)).resolves.toMatchObject({ setlist: { id: "s1" } });
  });

  it("a partial snapshot lists its missing PDFs as unavailable (B9)", async () => {
    await seedRaw(performSnapshotRecords(serverRows(), { stored: ["a2", "b1"] }));
    const rows = await open().load(new AbortController().signal);
    expect([...(rows.unavailableSheetMusicIds ?? [])]).toEqual(["a1"]);
  });
});

describe("snapshot source: PDFs from the device", () => {
  it("resolvePdfUrl → blob URL; release revokes it once", async () => {
    const session = open();
    await session.load(new AbortController().signal);
    const resolved = await session.resolvePdfUrl(A2, new AbortController().signal);
    expect(resolved.url).toBe("blob:test/1");
    resolved.release?.();
    resolved.release?.();
    expect(revoked).toEqual(["blob:test/1"]);
  });

  it("an aborted resolution rejects with AbortError", async () => {
    const session = open();
    await session.load(new AbortController().signal);
    const controller = new AbortController();
    const pending = session.resolvePdfUrl(A2, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("a viewer (pdf.js) error on a valid blob changes nothing: re-resolving works, key kept", async () => {
    const session = open();
    await session.load(new AbortController().signal);
    const first = await session.resolvePdfUrl(A2, new AbortController().signal);
    // The view's "Try again": release, then resolve again (the source is never told about the pdf.js error).
    first.release?.();
    const second = await session.resolvePdfUrl(A2, new AbortController().signal);
    expect(second.url).not.toBe(first.url);
    expect(await rawKeys()).toContain(offlineKeys.file(A2.file_url));
    expect(await getSnapshotMeta("s1")).toMatchObject({ completeness: "complete", missingFiles: [] });
  });

  it("a zero-length blob offline → unavailable for the session; key and meta untouched", async () => {
    await seedRaw(performSnapshotRecords(serverRows(), { fileBytes: { a1: 0 } }));
    const session = open();
    const emitted: PerformanceRows[] = [];
    session.subscribe((rows) => emitted.push(rows));
    await session.load(new AbortController().signal);
    await expect(session.resolvePdfUrl(A1, new AbortController().signal)).rejects.toBeInstanceOf(PdfUnavailableError);
    expect(emitted[emitted.length - 1]?.unavailableSheetMusicIds?.has("a1")).toBe(true);
    await flush();
    expect(await rawKeys()).toContain(offlineKeys.file(A1.file_url));
    expect(await getSnapshotMeta("s1")).toMatchObject({ completeness: "complete", missingFiles: [] });
    expect(created).toEqual([]);
  });

  it("a zero-length blob online → recorded in missingFiles and the key deleted (Retry refetches)", async () => {
    await seedRaw(performSnapshotRecords(serverRows(), { fileBytes: { a1: 0 } }));
    const session = open();
    await session.load(new AbortController().signal);
    await flush();
    online = true;
    await expect(session.resolvePdfUrl(A1, new AbortController().signal)).rejects.toBeInstanceOf(PdfUnavailableError);
    await flush();
    expect(await rawKeys()).not.toContain(offlineKeys.file(A1.file_url));
    expect(await getSnapshotMeta("s1")).toMatchObject({
      completeness: "partial",
      missingFiles: [expect.objectContaining({ sheetMusicId: "a1", reason: "unknown" })],
    });
  });
});

describe("snapshot source: preferences (§5.6)", () => {
  it("offline: the choice is recorded on the device, no server call, never rejects (B6)", async () => {
    setOfflineCurrentUser(USER, { authenticated: false });
    const session = open();
    await session.load(new AbortController().signal);
    await expect(session.savePreference(A1)).resolves.toBeUndefined();
    expect(setMySheetMusicPreference).not.toHaveBeenCalled();
    expect((await getSnapshot("s1"))?.localPreferenceOverrides).toEqual({ a: "a1" });
    // Re-opening performance mode offline still shows it.
    const again = await open().load(new AbortController().signal);
    expect(again.preferredSheetMusicIds.a).toBe("a1");
  });

  it("opening online flushes the override to the server before the refresh (B6)", async () => {
    await seedRaw(performSnapshotRecords(serverRows(), { localPreferenceOverrides: { a: "a1" } }));
    online = true;
    await open().load(new AbortController().signal);
    await flush(60);
    expect(setMySheetMusicPreference).toHaveBeenCalledWith("a", "a1");
    const snapshot = await getSnapshot("s1");
    expect(snapshot?.localPreferenceOverrides).toEqual({});
    expect(snapshot?.preferredSheetMusicIds.a).toBe("a1");
  });

  it("online: server write, then the snapshot patch", async () => {
    online = true;
    const session = open();
    await session.load(new AbortController().signal);
    await flush(60);
    await session.savePreference(A1);
    expect(setMySheetMusicPreference).toHaveBeenCalledWith("a", "a1");
    expect((await getSnapshot("s1"))?.preferredSheetMusicIds.a).toBe("a1");
  });

  it("online but the server write fails: kept as a local override, no rejection", async () => {
    online = true;
    const session = open();
    await session.load(new AbortController().signal);
    await flush(60);
    vi.mocked(setMySheetMusicPreference).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(session.savePreference(A1)).resolves.toBeUndefined();
    expect((await getSnapshot("s1"))?.localPreferenceOverrides).toEqual({ a: "a1" });
  });
});

describe("snapshot source: background refresh (A3)", () => {
  it("emits the refreshed rows and keeps identity for unchanged parts", async () => {
    online = true;
    server.setlist = setlistRow(
      [
        { type: "song", song_id: "b", position: 0 },
        { type: "break", id: "brk-1", label: "Break", position: 1 },
        { type: "song", song_id: "a", position: 2 },
      ] as SetlistItem[],
      { updated_at: "2026-09-24T00:00:00Z" }
    );
    const session = open();
    const emitted: PerformanceRows[] = [];
    session.subscribe((rows) => emitted.push(rows));
    const loaded = await session.load(new AbortController().signal);
    // The background refresh goes through fake-indexeddb: wait for it, not for a fixed number of turns.
    await vi.waitFor(() => expect(emitted.length).toBeGreaterThan(0));
    const last = emitted[emitted.length - 1]!;
    expect(last.setlist.songs.map((i) => i.position)).toEqual([0, 1, 2]);
    expect(last.setlist).not.toBe(loaded.setlist);
    expect(last.songsById).toBe(loaded.songsById);
    expect(last.sheetMusicBySongId).toBe(loaded.sheetMusicBySongId);
    expect(last.preferredSheetMusicIds).toBe(loaded.preferredSheetMusicIds);
  });

  it("an unchanged server emits nothing", async () => {
    online = true;
    const session = open();
    const emitted: PerformanceRows[] = [];
    session.subscribe((rows) => emitted.push(rows));
    await session.load(new AbortController().signal);
    await flush(80);
    expect(getSetlist).toHaveBeenCalled();
    expect(emitted).toEqual([]);
  });

  it("a new PDF appears as unavailable ('Not downloaded'), no file request (B13)", async () => {
    online = true;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    server.sheetMusic.push(sheet("b2", "b", 1));
    const session = open();
    const emitted: PerformanceRows[] = [];
    session.subscribe((rows) => emitted.push(rows));
    await session.load(new AbortController().signal);
    await vi.waitFor(() => expect(emitted.length).toBeGreaterThan(0));
    const last = emitted[emitted.length - 1]!;
    expect(last.sheetMusicBySongId.b.map((sm) => sm.id)).toEqual(["b1", "b2"]);
    expect(last.unavailableSheetMusicIds?.has("b2")).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect((await getSnapshotMeta("s1"))?.freshness).toBe("outdated");
  });

  it("a failed refresh is silent and reports the network failure", async () => {
    online = true;
    vi.mocked(getSongsByIds).mockRejectedValue(new TypeError("Failed to fetch"));
    const session = open();
    await expect(session.load(new AbortController().signal)).resolves.toBeTruthy();
    await vi.waitFor(() => expect(reportNetworkFailure).toHaveBeenCalled());
  });
});

describe("snapshot source: reorder write-through (B12)", () => {
  it("saveOrder writes to the server, emits, and patches the snapshot", async () => {
    online = true;
    const session = open();
    const emitted: PerformanceRows[] = [];
    await session.load(new AbortController().signal);
    await flush(60);
    session.subscribe((rows) => emitted.push(rows));
    const next: SetlistItem[] = [
      { type: "song", song_id: "b", position: 0 },
      { type: "break", id: "brk-1", label: "Break", position: 1 },
      { type: "song", song_id: "a", position: 2 },
    ];
    await session.saveOrder(next);
    expect(updateSetlist).toHaveBeenCalledWith("s1", { songs: next });
    expect(emitted[emitted.length - 1]?.setlist.songs).toEqual(next);
    const snapshot = await getSnapshot("s1");
    expect(snapshot?.setlist.songs.map((i) => ("song_id" in i ? i.song_id : i.id))).toEqual(["b", "brk-1", "a"]);
    // Offline after leaving: the new order is what opens.
    online = false;
    const reopened = await open().load(new AbortController().signal);
    expect(reopened.setlist.songs[0]).toMatchObject({ song_id: "b" });
  });

  it("a failed server write rejects and leaves the snapshot untouched", async () => {
    online = true;
    const session = open();
    await session.load(new AbortController().signal);
    await flush(60);
    const before = await getSnapshot("s1");
    vi.mocked(updateSetlist).mockRejectedValueOnce(new Error("500"));
    await expect(session.saveOrder([])).rejects.toThrow("500");
    expect(await getSnapshot("s1")).toEqual(before);
  });

  it("offline, saveOrder rejects without a request", async () => {
    const session = open();
    await session.load(new AbortController().signal);
    await expect(session.saveOrder([])).rejects.toThrow();
    expect(updateSetlist).not.toHaveBeenCalled();
  });
});

describe("shareRows", () => {
  it("returns prev when nothing changed, and reuses unchanged parts otherwise", () => {
    const base: PerformanceRows = {
      setlist: setlistRow(),
      songsById: {},
      sheetMusicBySongId: { a: [A1, A2] },
      preferredSheetMusicIds: { a: "a2" },
      preferredInstrument: null,
      unavailableSheetMusicIds: new Set(["x"]),
    };
    const copy = structuredClone({ ...base, unavailableSheetMusicIds: undefined });
    const same = shareRows(base, { ...copy, unavailableSheetMusicIds: new Set(["x"]) });
    expect(same).toBe(base);
    const changed = shareRows(base, { ...copy, preferredSheetMusicIds: { a: "a1" }, unavailableSheetMusicIds: new Set(["x"]) });
    expect(changed).not.toBe(base);
    expect(changed.setlist).toBe(base.setlist);
    expect(changed.sheetMusicBySongId).toBe(base.sheetMusicBySongId);
    expect(changed.unavailableSheetMusicIds).toBe(base.unavailableSheetMusicIds);
  });
});
