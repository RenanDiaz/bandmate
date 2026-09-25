import { IDBFactory } from "fake-indexeddb";
import { createStore, entries, keys, setMany } from "idb-keyval";
import {
  OFFLINE_DB_NAME,
  OFFLINE_SCHEMA_VERSION,
  OFFLINE_STORE_NAME,
  __resetOfflineStoreForTests,
  offlineKeys,
} from "../lib/offlineStore";
import { __resetOfflineServiceForTests } from "../services/offlineSetlistService";
import type { OfflineSnapshot, OfflineSnapshotMeta } from "../services/offlineSetlistService";
import type { Band } from "../services/bandsService";

/** Fresh IndexedDB, localStorage and module state for each test. */
export function resetOfflineTestEnv(): void {
  Object.defineProperty(globalThis, "indexedDB", { value: new IDBFactory(), configurable: true, writable: true });
  __resetOfflineStoreForTests();
  __resetOfflineServiceForTests();
  localStorage.clear();
}

function rawStore() {
  return createStore(OFFLINE_DB_NAME, OFFLINE_STORE_NAME);
}

/** Writes records straight into the database, bypassing the service (downloads arrive in PR 2.2b). */
export async function seedRaw(records: Record<string, unknown>): Promise<void> {
  await setMany(Object.entries(records), rawStore());
}

export async function rawKeys(): Promise<string[]> {
  return (await keys(rawStore())).map(String).sort();
}

export async function rawEntries(): Promise<Record<string, unknown>> {
  return Object.fromEntries((await entries(rawStore())).map(([k, v]) => [String(k), v]));
}

export function band(id: number, name = `Band ${id}`): Band {
  return { id, name, owner_id: "owner", created_at: "2026-01-01T00:00:00Z", user_role: "member" };
}

/** A complete snapshot (meta + rows + one file + band) as the download of PR 2.2b will write it. */
export function snapshotRecords(opts: {
  userId: string;
  setlistId: string;
  bandId?: number;
  setlistName?: string;
  savedAt?: string;
  schemaVersion?: number;
}): Record<string, unknown> {
  const bandId = opts.bandId ?? 1;
  const storagePath = `${bandId}/song-${opts.setlistId}/sm-${opts.setlistId}.pdf`;
  const meta: OfflineSnapshotMeta = {
    schemaVersion: OFFLINE_SCHEMA_VERSION,
    setlistId: opts.setlistId,
    bandId,
    userId: opts.userId,
    setlistName: opts.setlistName ?? `Setlist ${opts.setlistId}`,
    savedAt: opts.savedAt ?? "2026-09-20T10:00:00.000Z",
    completeness: "complete",
    bytes: 4,
    fileCount: 1,
    missingFiles: [],
    fingerprint: { setlistUpdatedAt: "", songs: [], sheetMusic: [], hash: "" },
    freshness: "unknown",
    lastCheckedAt: null,
    rowsUpdatedAt: opts.savedAt ?? "2026-09-20T10:00:00.000Z",
    lastDiff: null,
    verifiedAt: null,
  };
  const snapshot = {
    schemaVersion: OFFLINE_SCHEMA_VERSION,
    setlistId: opts.setlistId,
    userId: opts.userId,
    band: band(bandId),
    setlist: { id: opts.setlistId, name: meta.setlistName },
    songsById: {},
    sheetMusicBySongId: {},
    files: [{ storagePath, sheetMusicId: `sm-${opts.setlistId}`, songId: `song-${opts.setlistId}`, rowUpdatedAt: "" }],
    preferredSheetMusicIds: {},
    preferredInstrument: null,
    localPreferenceOverrides: {},
  } as unknown as OfflineSnapshot;
  const version = opts.schemaVersion ?? OFFLINE_SCHEMA_VERSION;
  return {
    [offlineKeys.snapshotMeta(opts.setlistId)]: { ...meta, schemaVersion: version },
    [offlineKeys.snapshot(opts.setlistId)]: { ...snapshot, schemaVersion: version },
    [offlineKeys.band(bandId)]: band(bandId),
    [offlineKeys.file(storagePath)]: {
      storagePath,
      blob: new Blob(["%PDF"], { type: "application/pdf" }),
      bytes: 4,
      downloadedAt: meta.savedAt,
    },
  };
}

export function storeMeta(schemaVersion: number = OFFLINE_SCHEMA_VERSION) {
  return { [offlineKeys.meta]: { schemaVersion, persisted: null, lastGcAt: null } };
}

/** Lets fake-indexeddb (setImmediate) and promise chains run, independent of fake timers. */
export async function flush(turns = 30): Promise<void> {
  for (let i = 0; i < turns; i++) await new Promise((resolve) => setImmediate(resolve));
}
