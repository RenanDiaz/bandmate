import { OFFLINE_SCHEMA_VERSION, offlineKeys } from "../lib/offlineStore";
import type { OfflineMissingFile, OfflineSnapshot, OfflineSnapshotMeta } from "../services/offlineSetlistService";
import type { Setlist, SetlistItem } from "../services/setlistsService";
import type { Song } from "../services/songsService";
import type { SheetMusic } from "../services/songSheetMusicService";
import { band } from "./offlineFixtures";

/**
 * Rows for performance-mode tests (PR 2.4): band 7, setlist "s1" with songs
 * a (PDFs a1, a2) and b (PDF b1) and a break between them. A "server" copy of
 * the same rows is what the mocked data services return.
 */

export const BAND_ID = 7;
export const USER = "user-a";

export function song(id: string, title = `Song ${id}`): Song {
  return { id, title, user_id: "owner", band_id: BAND_ID, created_at: "2026-01-01T00:00:00Z" };
}

export function sheet(id: string, songId: string, position: number, extra: Partial<SheetMusic> = {}): SheetMusic {
  return {
    id,
    song_id: songId,
    name: `PDF ${id}`,
    file_url: `${BAND_ID}/${songId}/${id}.pdf`,
    page_timings: [],
    position,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-02-01T00:00:00Z",
    ...extra,
  };
}

export const pathOf = (sm: SheetMusic) => sm.file_url;

export function items(): SetlistItem[] {
  return [
    { type: "song", song_id: "a", position: 0 },
    { type: "break", id: "brk-1", label: "Break", position: 1 },
    { type: "song", song_id: "b", position: 2 },
  ];
}

export function setlistRow(songs: SetlistItem[] = items(), extra: Partial<Setlist> = {}): Setlist {
  return {
    id: "s1",
    band_id: BAND_ID,
    user_id: "owner",
    name: "Friday",
    songs,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-03-01T00:00:00Z",
    ...extra,
  };
}

export interface ServerRows {
  setlist: Setlist;
  songs: Song[];
  sheetMusic: SheetMusic[];
  preferences: Record<string, string>;
}

export function serverRows(): ServerRows {
  return {
    setlist: setlistRow(),
    songs: [song("a"), song("b")],
    sheetMusic: [sheet("a1", "a", 0), sheet("a2", "a", 1), sheet("b1", "b", 0)],
    preferences: { a: "a2" },
  };
}

export function groupSheetMusic(rows: SheetMusic[], songIds: string[]): Record<string, SheetMusic[]> {
  const grouped: Record<string, SheetMusic[]> = {};
  for (const id of songIds) grouped[id] = rows.filter((sm) => sm.song_id === id).sort((x, y) => x.position - y.position);
  return grouped;
}

/**
 * The raw store records of a committed snapshot of `rows`. `stored` lists the
 * sheet music ids whose file is on the device (default: all); the others are
 * in missingFiles with `missingReason`.
 */
export function performSnapshotRecords(
  rows: ServerRows = serverRows(),
  opts: {
    userId?: string;
    stored?: string[];
    missingReason?: OfflineMissingFile["reason"];
    localPreferenceOverrides?: Record<string, string>;
    fileBytes?: Record<string, number>;
    rowsUpdatedAt?: string;
  } = {}
): Record<string, unknown> {
  const userId = opts.userId ?? USER;
  const songIds = rows.songs.map((s) => s.id);
  const stored = new Set(opts.stored ?? rows.sheetMusic.map((sm) => sm.id));
  const files = rows.sheetMusic.map((sm) => ({
    storagePath: sm.file_url,
    sheetMusicId: sm.id,
    songId: sm.song_id,
    rowUpdatedAt: sm.updated_at,
  }));
  const missingFiles: OfflineMissingFile[] = rows.sheetMusic
    .filter((sm) => !stored.has(sm.id))
    .map((sm) => ({ storagePath: sm.file_url, sheetMusicId: sm.id, songId: sm.song_id, reason: opts.missingReason ?? "quota", bytes: null }));
  const savedAt = "2026-09-20T10:00:00.000Z";
  const meta: OfflineSnapshotMeta = {
    schemaVersion: OFFLINE_SCHEMA_VERSION,
    setlistId: rows.setlist.id,
    bandId: BAND_ID,
    userId,
    setlistName: rows.setlist.name,
    savedAt,
    completeness: missingFiles.length > 0 ? "partial" : "complete",
    bytes: 0,
    fileCount: stored.size,
    missingFiles,
    fingerprint: { setlistUpdatedAt: rows.setlist.updated_at, songs: [], sheetMusic: [], hash: "" },
    freshness: "unknown",
    lastCheckedAt: null,
    rowsUpdatedAt: opts.rowsUpdatedAt ?? savedAt,
    lastDiff: null,
    verifiedAt: null,
  };
  const songsById: Record<string, Song> = {};
  for (const s of rows.songs) songsById[s.id] = s;
  const snapshot: OfflineSnapshot = {
    schemaVersion: OFFLINE_SCHEMA_VERSION,
    setlistId: rows.setlist.id,
    userId,
    band: band(BAND_ID),
    setlist: structuredClone(rows.setlist),
    songsById: structuredClone(songsById),
    sheetMusicBySongId: groupSheetMusic(structuredClone(rows.sheetMusic), songIds),
    files,
    preferredSheetMusicIds: { ...rows.preferences },
    preferredInstrument: null,
    localPreferenceOverrides: opts.localPreferenceOverrides ?? {},
  };
  const records: Record<string, unknown> = {
    [offlineKeys.snapshotMeta(rows.setlist.id)]: meta,
    [offlineKeys.snapshot(rows.setlist.id)]: snapshot,
    [offlineKeys.band(BAND_ID)]: band(BAND_ID),
  };
  for (const sm of rows.sheetMusic) {
    if (!stored.has(sm.id)) continue;
    const bytes = opts.fileBytes?.[sm.id] ?? 4;
    records[offlineKeys.file(sm.file_url)] = {
      storagePath: sm.file_url,
      blob: new Blob([new Uint8Array(bytes).fill(37)], { type: "application/pdf" }),
      bytes,
      downloadedAt: savedAt,
    };
  }
  return records;
}
