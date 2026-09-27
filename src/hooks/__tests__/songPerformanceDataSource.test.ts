import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/songsService", () => ({ getSongsByIds: vi.fn() }));
vi.mock("../../services/songSheetMusicService", () => ({ getSheetMusicForSongs: vi.fn() }));
vi.mock("../../services/sheetMusicStorageService", () => ({ getSheetMusicUrl: vi.fn() }));
vi.mock("../../services/sheetMusicPreferencesService", () => ({
  getMySheetMusicPreferences: vi.fn(),
  getPreferredInstrument: vi.fn(() => null),
  setPreferredInstrument: vi.fn(),
  setMySheetMusicPreference: vi.fn(),
}));

import { getSongsByIds } from "../../services/songsService";
import { getSheetMusicForSongs } from "../../services/songSheetMusicService";
import { getSheetMusicUrl } from "../../services/sheetMusicStorageService";
import { getMySheetMusicPreferences, setMySheetMusicPreference } from "../../services/sheetMusicPreferencesService";
import { BAND_ID, groupSheetMusic, sheet, song } from "../../test/performFixtures";
import type { SheetMusic } from "../../services/songSheetMusicService";
import type { Song } from "../../services/songsService";
import { createSongPerformanceDataSource } from "../songPerformanceDataSource";
import { PerformanceDataError } from "../performanceDataSource";
import type { PerformanceRows, PerformanceSession } from "../performanceDataSource";

const A1 = sheet("a1", "a", 0);
const A2 = sheet("a2", "a", 1);

let songs: Song[];
let sheetMusic: SheetMusic[];
let bandId: number | undefined;

function open(songId = "a"): PerformanceSession {
  return createSongPerformanceDataSource({ getBandId: () => bandId }).open({ kind: "song", songId });
}

async function loadError(session: PerformanceSession): Promise<unknown> {
  return session.load(new AbortController().signal).then(
    () => null,
    (error: unknown) => error
  );
}

beforeEach(() => {
  songs = [{ ...song("a", "Yesterday"), artist: "The Beatles", created_at: "2026-02-02T00:00:00Z" }];
  sheetMusic = [A1, A2];
  bandId = BAND_ID;
  vi.mocked(getSongsByIds).mockImplementation(async (ids) => structuredClone(songs.filter((s) => ids.includes(s.id))));
  vi.mocked(getSheetMusicForSongs).mockImplementation(async (ids) => groupSheetMusic(structuredClone(sheetMusic), ids));
  vi.mocked(getMySheetMusicPreferences).mockImplementation(async () => ({ a: "a2" }));
  vi.mocked(setMySheetMusicPreference).mockReset();
  vi.mocked(setMySheetMusicPreference).mockResolvedValue(undefined);
  vi.mocked(getSheetMusicUrl).mockImplementation(async (path) => `https://signed/${path}`);
});

describe("song source: load (song-performance §3.2)", () => {
  it("builds a one-item synthetic setlist from the song", async () => {
    const rows = await open().load(new AbortController().signal);
    expect(rows.setlist).toEqual({
      id: "song:a",
      band_id: BAND_ID,
      user_id: "owner",
      name: "Yesterday",
      description: undefined,
      is_draft: false,
      songs: [{ type: "song", song_id: "a", position: 0 }],
      youtube_playlist_url: undefined,
      created_at: "2026-02-02T00:00:00Z",
      updated_at: "2026-02-02T00:00:00Z",
    });
    expect(Object.keys(rows.songsById)).toEqual(["a"]);
    expect(rows.sheetMusicBySongId).toEqual({ a: [A1, A2] });
    expect(rows.preferredSheetMusicIds).toEqual({ a: "a2" });
    expect(getSongsByIds).toHaveBeenCalledWith(["a"]);
    expect(getSheetMusicForSongs).toHaveBeenCalledWith(["a"]);
  });

  it("no row → not-found", async () => {
    songs = [];
    const error = await loadError(open());
    expect(error).toBeInstanceOf(PerformanceDataError);
    expect((error as PerformanceDataError).code).toBe("not-found");
  });

  it("a song of another band → not-found", async () => {
    bandId = BAND_ID + 1;
    expect(((await loadError(open())) as PerformanceDataError).code).toBe("not-found");
  });

  it("no selected band → not-found", async () => {
    bandId = undefined;
    expect(((await loadError(open())) as PerformanceDataError).code).toBe("not-found");
  });

  it("a failed song read → network", async () => {
    vi.mocked(getSongsByIds).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(((await loadError(open())) as PerformanceDataError).code).toBe("network");
  });

  it("a failed sheet music read still emits rows and marks the session stale", async () => {
    vi.mocked(getSheetMusicForSongs).mockRejectedValueOnce(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const session = open();
    const rows = await session.load(new AbortController().signal);
    expect(rows.sheetMusicBySongId).toEqual({});
    expect(session.isSheetMusicStale()).toBe(true);
    await session.refresh();
    expect(session.isSheetMusicStale()).toBe(false);
  });

  it("a failed preferences read is swallowed", async () => {
    vi.mocked(getMySheetMusicPreferences).mockRejectedValueOnce(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const rows = await open().load(new AbortController().signal);
    expect(rows.preferredSheetMusicIds).toEqual({});
  });

  it("an aborted load rejects with AbortError", async () => {
    const abort = new AbortController();
    const session = open();
    const pending = session.load(abort.signal);
    abort.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("a setlist target handed to the song source → not-found", async () => {
    const session = createSongPerformanceDataSource({ getBandId: () => bandId }).open({ kind: "setlist", setlistId: "s1" });
    expect(((await loadError(session)) as PerformanceDataError).code).toBe("not-found");
  });
});

describe("song source: after load", () => {
  let session: PerformanceSession;
  let loaded: PerformanceRows;
  let emitted: PerformanceRows[];

  beforeEach(async () => {
    session = open();
    loaded = await session.load(new AbortController().signal);
    emitted = [];
    session.subscribe((rows) => emitted.push(rows));
  });

  it("refresh re-reads sheet music and keeps the setlist identity", async () => {
    sheetMusic = [A1, A2, sheet("a3", "a", 2)];
    await session.refresh();
    expect(emitted).toHaveLength(1);
    expect(emitted[0].setlist).toBe(loaded.setlist);
    expect(emitted[0].songsById).toBe(loaded.songsById);
    expect(emitted[0].sheetMusicBySongId.a.map((sm) => sm.id)).toEqual(["a1", "a2", "a3"]);
  });

  it("refresh with nothing changed emits nothing", async () => {
    await session.refresh();
    expect(emitted).toHaveLength(0);
  });

  it("saveOrder rejects", async () => {
    await expect(session.saveOrder([])).rejects.toThrow("song target has no order");
  });

  it("savePreference calls setMySheetMusicPreference and emits optimistically", async () => {
    await session.savePreference(A1);
    expect(setMySheetMusicPreference).toHaveBeenCalledWith("a", "a1");
    expect(emitted[emitted.length - 1].preferredSheetMusicIds).toEqual({ a: "a1" });
    expect(emitted[emitted.length - 1].setlist).toBe(loaded.setlist);
  });

  it("savePreference for the current choice makes no server call", async () => {
    await session.savePreference(A2);
    expect(setMySheetMusicPreference).not.toHaveBeenCalled();
  });

  it("resolvePdfUrl returns a signed URL", async () => {
    await expect(session.resolvePdfUrl(A1, new AbortController().signal)).resolves.toEqual({ url: `https://signed/${A1.file_url}` });
  });

  it("close stops emits", async () => {
    session.close();
    sheetMusic = [A1];
    await session.refresh();
    expect(emitted).toHaveLength(0);
  });
});
