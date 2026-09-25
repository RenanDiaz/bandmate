import type { Band } from "./bandsService";
import type { Setlist } from "./setlistsService";
import type { Song } from "./songsService";
import type { SheetMusic } from "./songSheetMusicService";
import type { OfflineSchemaWipeNotice, OfflineStoreMeta } from "../lib/offlineStore";
import {
  OFFLINE_KEY_PREFIX,
  OFFLINE_SCHEMA_VERSION,
  clearStore,
  offlineKeys,
  openStore,
  readKey,
  readKeys,
  readMany,
  removeKey,
  wipeStoreForSchema,
  writeKey,
} from "../lib/offlineStore";
import { clearAllPerformPositions } from "../lib/performPosition";

/**
 * Offline copies of setlists (spec docs/specs/offline-performance-phase2-3.md,
 * §3 and §5). PR 2.2a: the store, reads, owner filter, auth hooks and wipe.
 * Downloads, journal/resume, quota, GC and persistence arrive in PR 2.2b.
 *
 * Every read filters by the current user set through setOfflineCurrentUser();
 * with no current user (signed out or session-lost) they return empty/null
 * without deleting anything (A1). When IndexedDB is unavailable every read
 * returns empty/null too ("storage-unavailable", §5.4).
 */

export { OFFLINE_SCHEMA_VERSION };
export type { OfflineStoreMeta, OfflineSchemaWipeNotice };

// ---------------------------------------------------------------------------
// Types (§3.2). Declared in full: they are the contract with PR 2.2b and later.
// ---------------------------------------------------------------------------

/** Small record used by lists and badges; never contains rows or blobs. */
export interface OfflineSnapshotMeta {
  schemaVersion: typeof OFFLINE_SCHEMA_VERSION;
  setlistId: string;
  bandId: number;
  /** auth.uid() that downloaded it. Snapshots of another user are invisible (§3.5). */
  userId: string;
  setlistName: string;
  /** ISO, when the last commit finished. */
  savedAt: string;
  /** "complete" = every planned file is present; "partial" = some files failed (§4.4). */
  completeness: "complete" | "partial";
  /** Sum of stored file bytes referenced by this snapshot. */
  bytes: number;
  fileCount: number;
  missingFiles: OfflineMissingFile[];
  fingerprint: OfflineFingerprint;
  freshness: "unknown" | "fresh" | "outdated" | "deleted";
  lastCheckedAt: string | null;
  /** When rows were last committed by a refresh or a perform-mode write (≥ savedAt). */
  rowsUpdatedAt: string;
  lastDiff: OfflineDiff | null;
  verifiedAt: string | null;
}

export interface OfflineMissingFile {
  storagePath: string;
  sheetMusicId: string;
  songId: string;
  reason: "quota" | "network" | "not-found" | "forbidden" | "unknown" | "not-downloaded";
  bytes: number | null;
}

/** The data performance mode renders from. */
export interface OfflineSnapshot {
  schemaVersion: typeof OFFLINE_SCHEMA_VERSION;
  setlistId: string;
  userId: string;
  /** Full row incl. user_role (C3). */
  band: Band;
  /** Normalized (ids on special items). */
  setlist: Setlist;
  /** Only the songs referenced by setlist.songs, keyed by song id. */
  songsById: Record<string, Song>;
  /** song_sheet_music rows for those songs, sorted by position, keyed by song id. */
  sheetMusicBySongId: Record<string, SheetMusic[]>;
  /** Files this snapshot references. Presence in the store is not guaranteed (see missingFiles). */
  files: OfflineFileRef[];
  /** user_sheet_music_preferences at download time: song id -> sheet music id. */
  preferredSheetMusicIds: Record<string, string>;
  preferredInstrument: string | null;
  /** Preferences chosen while offline, not yet on the server (C5, §5.6). */
  localPreferenceOverrides: Record<string, string>;
}

export interface OfflineFileRef {
  /** "{bandId}/{songId}/{sheetMusicId}.pdf" == SheetMusic.file_url */
  storagePath: string;
  sheetMusicId: string;
  songId: string;
  /** song_sheet_music.updated_at as last refreshed; part of the fingerprint. Not a file identity. */
  rowUpdatedAt: string;
}

/** Stored once per storage path, shared across snapshots (§3.5 #3). */
export interface OfflineFileRecord {
  storagePath: string;
  blob: Blob;
  bytes: number;
  downloadedAt: string;
}

export interface OfflineFingerprint {
  setlistUpdatedAt: string;
  songs: Array<[songId: string, updatedAt: string]>;
  sheetMusic: Array<[id: string, songId: string, updatedAt: string, fileUrl: string]>;
  hash: string;
}

export interface OfflineDiff {
  applied: {
    setlistChanged: boolean;
    songsChanged: string[];
    songsAdded: string[];
    songsRemoved: string[];
    sheetMusicChanged: string[];
    sheetMusicAdded: string[];
    sheetMusicRemoved: string[];
  };
  filesToDownload: Array<OfflineFileRef & { bytes: number | null }>;
  filesReleased: OfflineFileRef[];
}

export interface DownloadPlan {
  setlistId: string;
  bandId: number;
  songCount: number;
  filesToDownload: Array<OfflineFileRef & { bytes: number | null }>;
  filesAlreadyPresent: OfflineFileRef[];
  filesToDelete: OfflineFileRef[];
  bytesToDownload: number;
  filesWithUnknownSize: number;
  bytesAlreadyPresent: number;
  estimate: { usage: number; quota: number } | null;
}

/** Progress of an in-flight or interrupted download (§4). Written by PR 2.2b. */
export interface OfflineDownloadJournal {
  schemaVersion: typeof OFFLINE_SCHEMA_VERSION;
  setlistId: string;
  userId: string;
  startedAt: string;
  plan: DownloadPlan;
  outcomes: Record<string, "stored" | "skipped-present" | OfflineMissingFile["reason"]>;
  pendingSnapshot: Omit<OfflineSnapshot, "files"> & { files: OfflineFileRef[] };
}

// ---------------------------------------------------------------------------
// Errors and events (§5.4, §5.5)
// ---------------------------------------------------------------------------

export type OfflineErrorCode =
  | "not-authenticated"
  | "offline"
  | "setlist-not-found"
  | "download-in-progress"
  | "plan-stale"
  | "storage-unavailable"
  | "quota-rows"
  | "cancelled";

export class OfflineError extends Error {
  readonly code: OfflineErrorCode;
  readonly cause: unknown;
  constructor(code: OfflineErrorCode, message?: string, options?: { cause?: unknown }) {
    super(message ?? code);
    this.name = "OfflineError";
    this.code = code;
    this.cause = options?.cause;
  }
}

/** PR 2.2b fills this in; declared here so the event union is complete. */
export interface DownloadProgress {
  state: "planning" | "awaiting-confirmation" | "downloading" | "committing";
  filesDone: number;
  filesTotal: number;
  bytesDone: number;
  bytesTotal: number;
  currentFile: { songTitle: string; name: string } | null;
}

export type OfflineEvent =
  | { type: "snapshot-changed"; setlistId: string }
  | { type: "download-progress"; setlistId: string; progress: DownloadProgress }
  | { type: "store-wiped"; reason: "sign-out" | "user-changed" | "schema" }
  | { type: "visibility-changed" };

const listeners = new Set<(e: OfflineEvent) => void>();

export function subscribe(listener: (e: OfflineEvent) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(event: OfflineEvent): void {
  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch (error) {
      console.error("Offline event listener failed:", error);
    }
  }
}

// ---------------------------------------------------------------------------
// Store access
// ---------------------------------------------------------------------------

/**
 * Store meta and schema check; wipes on mismatch, recording what was lost for
 * the A4 notice (§3.5 #2). Memoized per page load. Rejects with
 * `OfflineError("storage-unavailable")` when IndexedDB can't be opened.
 */
export async function openOfflineStore(): Promise<OfflineStoreMeta> {
  const result = await openStore();
  if (result.status === "unavailable") {
    throw new OfflineError("storage-unavailable", "Offline storage is unavailable on this device", {
      cause: result.error,
    });
  }
  if (result.schemaWipe && !schemaWipeAnnounced) {
    schemaWipeAnnounced = true;
    emit({ type: "store-wiped", reason: "schema" });
  }
  return result.meta;
}

let schemaWipeAnnounced = false;

/** Opens the store; false when it is unavailable. Reads use this and fall back to empty/null. */
async function storeReady(): Promise<boolean> {
  try {
    await openOfflineStore();
    return true;
  } catch (error) {
    if (!(error instanceof OfflineError && error.code === "storage-unavailable")) {
      console.error("Offline store open failed:", error);
    }
    return false;
  }
}

/** A read that returns `fallback` instead of throwing (storage-unavailable, §5.4). */
async function safeRead<T>(fallback: T, read: () => Promise<T>): Promise<T> {
  if (!(await storeReady())) return fallback;
  try {
    return await read();
  } catch (error) {
    console.error("Offline store read failed:", error);
    return fallback;
  }
}

/** A record written by another schema: wipe the whole store, as a meta mismatch would (§3.5 #2). */
async function hasCurrentSchema(record: { schemaVersion?: unknown }): Promise<boolean> {
  if (record.schemaVersion === OFFLINE_SCHEMA_VERSION) return true;
  const fromVersion = typeof record.schemaVersion === "number" ? record.schemaVersion : null;
  await wipeStoreForSchema(fromVersion);
  emit({ type: "store-wiped", reason: "schema" });
  return false;
}

// ---------------------------------------------------------------------------
// Current user and auth hooks (§3.5 #1, §7.1)
// ---------------------------------------------------------------------------

let currentUserId: string | null = null;

/**
 * Set by BandContext on every auth resolution (§7.1). Every read filters by
 * this id; null (signed out or session-lost) makes them all return empty/null
 * without deleting anything (A1).
 */
export function setOfflineCurrentUser(userId: string | null): void {
  if (userId === currentUserId) return;
  currentUserId = userId;
  emit({ type: "visibility-changed" });
}

export function getOfflineCurrentUser(): string | null {
  return currentUserId;
}

/** The last uid that had a valid session on this device (`last-user`), or null. Read by BandContext only. */
export function getLastUserId(): Promise<string | null> {
  return safeRead(null, async () => {
    const value = await readKey<unknown>(offlineKeys.lastUser);
    return typeof value === "string" && value ? value : null;
  });
}

// Confirmations and wipes are serialized: a getSession() result and a
// SIGNED_IN event for the same sign-in may arrive together.
let authQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = authQueue.then(task, task);
  authQueue = run.catch(() => undefined);
  return run;
}

/**
 * Called by BandContext with the uid of a **confirmed** session (§3.5 #1):
 * runs the wipe first if `last-user` is another uid, then writes `last-user`.
 * Never call it for a provisional or cached state. Never rejects.
 */
export function confirmSignedInUser(userId: string): Promise<{ wiped: boolean }> {
  return enqueue(async () => {
    if (!(await storeReady())) return { wiped: false };
    try {
      const lastUser = await readKey<unknown>(offlineKeys.lastUser);
      let wiped = false;
      if (typeof lastUser === "string" && lastUser && lastUser !== userId) {
        wiped = await runWipe("user-changed");
        // A failed wipe keeps the old `last-user`, so the next confirmation
        // retries it. The owner filter keeps the old records invisible meanwhile.
        if (!wiped) return { wiped: false };
      }
      if (lastUser !== userId) await writeKey(offlineKeys.lastUser, userId);
      return { wiped };
    } catch (error) {
      console.error("Could not record the signed-in user for offline copies:", error);
      return { wiped: false };
    }
  });
}

/**
 * Deletes every offline record (the IndexedDB store, `last-user` included)
 * and the `bandmate_perform_position_*` localStorage keys (A2).
 *
 * Only two callers (§3.5 #6): AuthButton's user-initiated sign-out, awaited
 * before `supabase.auth.signOut()`, and confirmSignedInUser() on a confirmed
 * sign-in with a different uid. Never on a null session or an involuntary
 * SIGNED_OUT. Never rejects: a failure is logged (the owner filter still hides
 * the records from anyone else).
 */
export function wipeAll(): Promise<void> {
  return enqueue(async () => {
    await runWipe("sign-out");
  });
}

async function runWipe(reason: "sign-out" | "user-changed"): Promise<boolean> {
  clearAllPerformPositions();
  if (!(await storeReady())) {
    emit({ type: "store-wiped", reason });
    return true;
  }
  try {
    await clearStore();
    emit({ type: "store-wiped", reason });
    return true;
  } catch (error) {
    console.error("Could not wipe offline copies:", error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Reads (§5.1)
// ---------------------------------------------------------------------------

function keysWithPrefix(all: string[], prefix: string): string[] {
  return all.filter((k) => k.startsWith(prefix));
}

function isSnapshotMeta(value: unknown): value is OfflineSnapshotMeta {
  return !!value && typeof value === "object" && typeof (value as OfflineSnapshotMeta).setlistId === "string";
}

/**
 * The current user's snapshot metas whose `snapshot:` exists too (§3.5 #4:
 * one without the other counts as absent). Wipes on a foreign schema.
 */
async function readOwnedMetas(userId: string): Promise<OfflineSnapshotMeta[]> {
  const all = await readKeys();
  const snapshotKeys = new Set(keysWithPrefix(all, OFFLINE_KEY_PREFIX.snapshot));
  const metaKeys = keysWithPrefix(all, OFFLINE_KEY_PREFIX.snapshotMeta);
  const values = await readMany<unknown>(metaKeys);
  const owned: OfflineSnapshotMeta[] = [];
  for (const value of values) {
    if (!isSnapshotMeta(value)) continue;
    if (!(await hasCurrentSchema(value))) return [];
    if (value.userId !== userId) continue;
    if (!snapshotKeys.has(offlineKeys.snapshot(value.setlistId))) continue;
    owned.push(value);
  }
  return owned;
}

/** All snapshot metas of the current user, newest savedAt first. Empty if none or store unavailable. */
export function listSnapshots(): Promise<OfflineSnapshotMeta[]> {
  const userId = currentUserId;
  if (!userId) return Promise.resolve([]);
  return safeRead([], async () => {
    const metas = await readOwnedMetas(userId);
    return metas.sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0));
  });
}

/** Meta and snapshot for one setlist, both present and owned by the current user, or null. */
async function readOwnedPair(
  setlistId: string,
  userId: string
): Promise<{ meta: OfflineSnapshotMeta; snapshot: OfflineSnapshot } | null> {
  const [meta, snapshot] = await readMany<unknown>([
    offlineKeys.snapshotMeta(setlistId),
    offlineKeys.snapshot(setlistId),
  ]);
  if (!isSnapshotMeta(meta) || !snapshot || typeof snapshot !== "object") return null;
  const typedSnapshot = snapshot as OfflineSnapshot;
  if (!(await hasCurrentSchema(meta)) || !(await hasCurrentSchema(typedSnapshot))) return null;
  if (meta.userId !== userId || typedSnapshot.userId !== userId) return null;
  return { meta, snapshot: typedSnapshot };
}

/** Meta only; null when absent, another user's, or wrong schema. */
export function getSnapshotMeta(setlistId: string): Promise<OfflineSnapshotMeta | null> {
  const userId = currentUserId;
  if (!userId) return Promise.resolve(null);
  return safeRead(null, async () => (await readOwnedPair(setlistId, userId))?.meta ?? null);
}

/** Full snapshot for performance mode; same null rules. */
export function getSnapshot(setlistId: string): Promise<OfflineSnapshot | null> {
  const userId = currentUserId;
  if (!userId) return Promise.resolve(null);
  return safeRead(null, async () => (await readOwnedPair(setlistId, userId))?.snapshot ?? null);
}

/**
 * The stored PDF, or null when not present or no user is current. Files are
 * shared across snapshots (§3.5 #3), so there is no per-file owner; hidden
 * mode still returns nothing. The caller creates and revokes the blob URL.
 */
export function getFile(storagePath: string): Promise<Blob | null> {
  if (!currentUserId) return Promise.resolve(null);
  return safeRead(null, async () => {
    const record = await readKey<OfflineFileRecord>(offlineKeys.file(storagePath));
    return record?.blob instanceof Blob ? record.blob : null;
  });
}

/** Bands of the current user seen in any of their snapshots (for BandContext offline, §7.2). */
export function listOfflineBands(): Promise<Band[]> {
  const userId = currentUserId;
  if (!userId) return Promise.resolve([]);
  return safeRead([], async () => {
    const metas = await readOwnedMetas(userId);
    const bandIds = [...new Set(metas.map((m) => m.bandId))];
    if (bandIds.length === 0) return [];
    const bands = await readMany<Band>(bandIds.map((id) => offlineKeys.band(id)));
    return bands
      .filter((b): b is Band => !!b && typeof b === "object" && typeof b.id === "number")
      .sort((a, b) => a.name.localeCompare(b.name));
  });
}

/** Whether hidden snapshots of `userId` exist, for the "Sign in again" state. Counts only; returns no names. */
export function countHiddenSnapshots(userId: string): Promise<number> {
  return safeRead(0, async () => (await readOwnedMetas(userId)).length);
}

// ---------------------------------------------------------------------------
// Schema-wipe notice (A4). The UI arrives in PR 2.5; the service exposes it now.
// ---------------------------------------------------------------------------

/** The schema-wipe notice entries for the current user, or null (A4). */
export function getSchemaWipeNotice(): Promise<Array<{
  setlistId: string;
  setlistName: string;
  bandId: number | null;
}> | null> {
  const userId = currentUserId;
  if (!userId) return Promise.resolve(null);
  return safeRead(null, async () => {
    const notice = await readKey<OfflineSchemaWipeNotice>(offlineKeys.schemaWipeNotice);
    if (!notice || !Array.isArray(notice.lost)) return null;
    const mine = notice.lost
      .filter((e) => e.userId === userId)
      .map(({ setlistId, setlistName, bandId }) => ({ setlistId, setlistName, bandId }));
    return mine.length > 0 ? mine : null;
  });
}

/**
 * No id: dismiss all of the current user's entries. With an id: drop that entry
 * (downloaded again, or gone). The key is deleted once no entries are left.
 *
 * By A1 the store holds one user's data at a time (a confirmed sign-in of
 * another uid wipes it first), so there is no per-user dismissal list. Entries
 * stay tagged with their userId only for the failed-wipe case, where the old
 * user's records linger until the wipe is retried: nobody else sees them.
 */
export function dismissSchemaWipeNotice(setlistId?: string): Promise<void> {
  const userId = currentUserId;
  if (!userId) return Promise.resolve();
  return safeRead(undefined, async () => {
    const notice = await readKey<OfflineSchemaWipeNotice>(offlineKeys.schemaWipeNotice);
    if (!notice || !Array.isArray(notice.lost)) return;
    const lost = notice.lost.filter(
      (e) => e.userId !== userId || (setlistId !== undefined && e.setlistId !== setlistId)
    );
    if (lost.length === notice.lost.length) return;
    if (lost.length === 0) {
      await removeKey(offlineKeys.schemaWipeNotice);
    } else {
      await writeKey(offlineKeys.schemaWipeNotice, { ...notice, lost });
    }
  });
}

/** Test-only: reset module state between tests. */
export function __resetOfflineServiceForTests(): void {
  currentUserId = null;
  schemaWipeAnnounced = false;
  authQueue = Promise.resolve();
  listeners.clear();
}
