import type { Band } from "./bandsService";
import type { Setlist } from "./setlistsService";
import type { Song } from "./songsService";
import type { SheetMusic } from "./songSheetMusicService";
import type { OfflineSchemaWipeNotice, OfflineStoreMeta, StoreTx } from "../lib/offlineStore";
import {
  OFFLINE_KEY_PREFIX,
  OFFLINE_SCHEMA_VERSION,
  StoreEpochChangedError,
  clearStore,
  isQuotaExceeded,
  localWipeCount,
  offlineKeys,
  openStore,
  readEpoch,
  readKey,
  readKeys,
  readMany,
  removeKey,
  transact,
  wipeStoreForSchema,
  writeKey,
} from "../lib/offlineStore";
import { FileFetchError, classifyHttpStatus, fetchFileWithStallTimeout, mapWithConcurrency } from "../lib/offlineFetch";
import { isNetworkError } from "../lib/networkErrors";
import { clearAllPerformPositions } from "../lib/performPosition";
import { deepEqual } from "../utils/deepEqual";
import { getSetlist, isSongItem, normalizeSetlistItems } from "./setlistsService";
import { getSongsByIds } from "./songsService";
import { getSheetMusicForSongs } from "./songSheetMusicService";
import { getMySheetMusicPreferences, getPreferredInstrument, setMySheetMusicPreference } from "./sheetMusicPreferencesService";
import { getMyBands } from "./bandsService";
import { createSheetMusicDownloadUrl, listSheetMusicFolderSizes } from "./sheetMusicStorageService";

/**
 * Offline copies of setlists (spec docs/specs/offline-performance-phase2-3.md,
 * §3 and §5). PR 2.2a: the store, reads, owner filter, auth hooks and wipe.
 * PR 2.2b: the download engine (plan, download, journal/resume, quota, GC,
 * persistence). PR 2.4: row refresh, the perform-mode patches and the
 * offline preference overrides, for the snapshot performance source.
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

/** Progress of an in-flight or interrupted download (§4). Deleted on commit or cancel. */
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
  // Anything that changes or clears snapshots makes a prefetched read stale.
  if (event.type === "snapshot-changed" || event.type === "store-wiped") ownedMetasPrefetch = null;
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
  abortActiveDownload("wiped");
  await wipeStoreForSchema(fromVersion);
  emit({ type: "store-wiped", reason: "schema" });
  return false;
}

// ---------------------------------------------------------------------------
// Current user and auth hooks (§3.5 #1, §7.1)
// ---------------------------------------------------------------------------

let currentUserId: string | null = null;
// True only in authMode "session": downloads need a valid session (§5.4), and
// "offline-cached" shows copies without one.
let currentUserAuthenticated = false;

/**
 * Set by BandContext on every auth resolution (§7.1). Every read filters by
 * this id; null (signed out or session-lost) makes them all return empty/null
 * without deleting anything (A1). `authenticated` is true only for a valid
 * session ("session"), never for "offline-cached": downloads check it before
 * starting and before every file (race rule 2).
 */
export function setOfflineCurrentUser(userId: string | null, opts: { authenticated?: boolean } = {}): void {
  currentUserAuthenticated = !!userId && opts.authenticated === true;
  if (userId === currentUserId) return;
  currentUserId = userId;
  emit({ type: "visibility-changed" });
}

/** The current user if they have a valid session, else null. */
function authenticatedUserId(): string | null {
  return currentUserAuthenticated ? currentUserId : null;
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
  // Race rule 1: the in-flight download stops now; its later writes are
  // refused by the epoch the clear below replaces.
  abortActiveDownload("wiped");
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

// A6/C7: the relaunch reads `last-user`'s metas while getSession() is still
// being raced, so the offline home and band list don't wait for a second pass
// over the store once the user is known. Used only for that uid, within a few
// seconds, and dropped on any snapshot change or wipe.
const PREFETCH_TTL_MS = 5_000;
let ownedMetasPrefetch: { userId: string; at: number; metas: Promise<OfflineSnapshotMeta[]> } | null = null;

/**
 * Starts reading `userId`'s snapshot metas now (BandContext's auth controller,
 * with `last-user`, in parallel with the A6 race). Reads nothing into view:
 * `listSnapshots` / `listOfflineBands` use it only once `userId` is the
 * current user, exactly as they would have read it themselves.
 */
export function prefetchOfflineReads(userId: string): void {
  ownedMetasPrefetch = {
    userId,
    at: Date.now(),
    metas: safeRead<OfflineSnapshotMeta[]>([], () => readOwnedMetas(userId)),
  };
}

function ownedMetas(userId: string): Promise<OfflineSnapshotMeta[]> {
  const prefetch = ownedMetasPrefetch;
  if (prefetch && prefetch.userId === userId && Date.now() - prefetch.at < PREFETCH_TTL_MS) return prefetch.metas;
  return readOwnedMetas(userId);
}

/** All snapshot metas of the current user, newest savedAt first. Empty if none or store unavailable. */
export function listSnapshots(): Promise<OfflineSnapshotMeta[]> {
  const userId = currentUserId;
  if (!userId) return Promise.resolve([]);
  return safeRead([], async () => {
    const metas = [...(await ownedMetas(userId))];
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
    const metas = await ownedMetas(userId);
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
// Schema-wipe notice (A4). Shown by SchemaWipeNotice (PR 2.5).
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

// ---------------------------------------------------------------------------
// Downloads (§4, §5.2). One at a time per device: an in-tab claim plus a Web
// Lock across tabs (race rule 4). Every write of a download is guarded by the
// store epoch (race rule 1) and checks that the owner still has a valid
// session (race rule 2). GC keeps whatever any journal references (race rule 3).
// ---------------------------------------------------------------------------

export interface DownloadOptions {
  onProgress?: (p: DownloadProgress) => void;
  signal?: AbortSignal;
  /** Phase 3: only fetch what the diff says changed. Default false = full plan. */
  incremental?: boolean;
}

export interface DownloadResult {
  state: "done" | "done-with-errors" | "cancelled" | "failed";
  /** null on cancelled/failed. */
  meta: OfflineSnapshotMeta | null;
  missingFiles: OfflineMissingFile[];
  failure: OfflineError | null;
}

/** A plan older than this is refused with `plan-stale` (§5.4): signed URLs and sizes may have changed. */
export const PLAN_MAX_AGE_MS = 10 * 60 * 1000;
/** An interrupted download older than this is discarded instead of resumed (§4.4). */
export const JOURNAL_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Storage folders listed in parallel at plan time (C7). */
export const PLAN_LIST_CONCURRENCY = 4;
/** Web Lock held for the whole of a download, across tabs (race rule 4). */
export const DOWNLOAD_LOCK_NAME = "bandmate-offline-download";

type Outcome = OfflineDownloadJournal["outcomes"][string];
type FailureReason = OfflineMissingFile["reason"];

/**
 * What a plan needs that DownloadPlan (the public, serializable part) does not
 * carry: its owner, when it was made, and the rows fetched at plan time. Keyed
 * by the plan object, so a plan that did not come from planDownload() in this
 * page is `plan-stale`.
 */
interface PlanContext {
  userId: string;
  createdAt: number;
  pendingSnapshot: OfflineDownloadJournal["pendingSnapshot"];
}
const planContexts = new WeakMap<DownloadPlan, PlanContext>();

interface DownloadJob {
  setlistId: string;
  userId: string;
  controller: AbortController;
  abortReason: "cancel" | "wiped" | null;
  /** localWipeCount() when the job was claimed: a clear in this tab since then stops it. */
  wipesAtClaim: number;
  /** Storage paths this job may still store or commit; GC in this tab keeps them. */
  paths: Set<string>;
}
let activeJob: DownloadJob | null = null;

function abortActiveDownload(reason: "cancel" | "wiped"): void {
  const job = activeJob;
  if (!job) return;
  job.abortReason ??= reason;
  job.controller.abort();
}

function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function referencedSongIds(setlist: Setlist): string[] {
  return [...new Set((setlist.songs || []).filter(isSongItem).map((item) => item.song_id))];
}

/** The files a snapshot of these rows references, one per storage path, in setlist order. */
function fileRefsOf(setlist: Setlist, sheetMusicBySongId: Record<string, SheetMusic[]>): OfflineFileRef[] {
  const files: OfflineFileRef[] = [];
  const seen = new Set<string>();
  for (const songId of referencedSongIds(setlist)) {
    for (const sm of sheetMusicBySongId[songId] ?? []) {
      if (!sm.file_url || seen.has(sm.file_url)) continue;
      seen.add(sm.file_url);
      files.push({ storagePath: sm.file_url, sheetMusicId: sm.id, songId, rowUpdatedAt: sm.updated_at ?? "" });
    }
  }
  return files;
}

function folderOf(storagePath: string): string {
  const slash = storagePath.lastIndexOf("/");
  return slash > 0 ? storagePath.slice(0, slash) : "";
}

async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (!estimate || typeof estimate.quota !== "number") return null;
    return { usage: estimate.usage ?? 0, quota: estimate.quota };
  } catch {
    return null;
  }
}

function toPlanError(error: unknown): unknown {
  if (error instanceof OfflineError) return error;
  if (error instanceof Error && error.message === "User not authenticated") {
    return new OfflineError("not-authenticated", undefined, { cause: error });
  }
  if ((error as { code?: unknown } | null)?.code === "PGRST116") {
    return new OfflineError("setlist-not-found", undefined, { cause: error });
  }
  if (isNetworkError(error)) return new OfflineError("offline", undefined, { cause: error });
  return error;
}

async function requireStoreForDownload(): Promise<void> {
  if (!(await storeReady())) throw new OfflineError("storage-unavailable");
}

/**
 * Planning only (§4.1 planning, §4.2): fetches the rows, sizes each storage
 * folder (C7, concurrency 4) and compares file keys with the store (by storage
 * path only). No writes. Rejects with OfflineError `not-authenticated`,
 * `offline`, `setlist-not-found` or `storage-unavailable`.
 *
 * `incremental` is accepted for the Phase 3 signature and ignored: every plan
 * is a full plan, which already downloads only the files the store lacks.
 */
export async function planDownload(setlistId: string, opts: { incremental?: boolean } = {}): Promise<DownloadPlan> {
  void opts.incremental; // Phase 3 (PR 3.3)
  const userId = authenticatedUserId();
  if (!userId) throw new OfflineError("not-authenticated");
  if (isBrowserOffline()) throw new OfflineError("offline");
  await requireStoreForDownload();

  let setlist: Setlist;
  let songs: Song[];
  let sheetMusicBySongId: Record<string, SheetMusic[]>;
  let preferredSheetMusicIds: Record<string, string>;
  let band: Band | undefined;
  try {
    setlist = await getSetlist(setlistId);
    const songIds = referencedSongIds(setlist);
    [songs, sheetMusicBySongId, preferredSheetMusicIds, band] = await Promise.all([
      getSongsByIds(songIds),
      getSheetMusicForSongs(songIds),
      // Preferences only choose which PDF opens first; the band order is the fallback.
      getMySheetMusicPreferences(songIds).catch((error: unknown) => {
        console.error("Offline plan: could not load sheet music preferences:", error);
        return {} as Record<string, string>;
      }),
      getMyBands(userId).then((bands) => bands.find((b) => b.id === setlist.band_id)),
    ]);
  } catch (error) {
    throw toPlanError(error);
  }
  if (!band) throw new OfflineError("setlist-not-found", "The setlist's band is not one of yours");
  if (authenticatedUserId() !== userId) throw new OfflineError("not-authenticated");

  const songsById: Record<string, Song> = {};
  for (const song of songs) songsById[song.id] = song;

  const files = fileRefsOf(setlist, sheetMusicBySongId);

  const folders = [...new Set(files.map((f) => folderOf(f.storagePath)))];
  const listings = await mapWithConcurrency(folders, PLAN_LIST_CONCURRENCY, (folder) =>
    listSheetMusicFolderSizes(folder).catch((error: unknown) => {
      // The files still download; they count under filesWithUnknownSize.
      console.warn(`Offline plan: could not list ${folder}:`, error);
      return {} as Record<string, number | null>;
    })
  );
  const sizes: Record<string, number | null> = Object.assign({}, ...listings);

  const storedKeys = new Set(await readKeys());
  const filesToDownload: DownloadPlan["filesToDownload"] = [];
  const filesAlreadyPresent: OfflineFileRef[] = [];
  let bytesAlreadyPresent = 0;
  for (const ref of files) {
    const key = offlineKeys.file(ref.storagePath);
    if (storedKeys.has(key)) {
      filesAlreadyPresent.push(ref);
      const record = await readKey<OfflineFileRecord>(key);
      bytesAlreadyPresent += record?.bytes ?? 0;
    } else {
      filesToDownload.push({ ...ref, bytes: sizes[ref.storagePath] ?? null });
    }
  }

  const plan: DownloadPlan = {
    setlistId,
    bandId: setlist.band_id,
    songCount: referencedSongIds(setlist).length,
    filesToDownload,
    filesAlreadyPresent,
    filesToDelete: [],
    bytesToDownload: filesToDownload.reduce((sum, f) => sum + (f.bytes ?? 0), 0),
    filesWithUnknownSize: filesToDownload.filter((f) => f.bytes === null).length,
    bytesAlreadyPresent,
    estimate: await storageEstimate(),
  };
  planContexts.set(plan, {
    userId,
    createdAt: Date.now(),
    pendingSnapshot: {
      schemaVersion: OFFLINE_SCHEMA_VERSION,
      setlistId,
      userId,
      band,
      setlist,
      songsById,
      sheetMusicBySongId,
      files,
      preferredSheetMusicIds,
      preferredInstrument: getPreferredInstrument(setlist.band_id),
      localPreferenceOverrides: {},
    },
  });
  return plan;
}

const LOCK_BUSY = Symbol("lock-busy");

/**
 * Runs `body` holding the cross-tab download lock (race rule 4). Resolves
 * LOCK_BUSY without running it when another tab holds the lock. Without the
 * Web Locks API (Safari < 15.4) only the in-tab claim applies: two tabs could
 * then download at once; their writes stay consistent (every file is one
 * transaction, the journal is per setlist) but can race for quota.
 */
async function withDownloadLock<T>(body: () => Promise<T>): Promise<T | typeof LOCK_BUSY> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks?.request) return body();
  return locks.request(DOWNLOAD_LOCK_NAME, { ifAvailable: true }, async (lock) => (lock ? body() : LOCK_BUSY));
}

/**
 * Runs a plan from planDownload() to completion (§4.1). Rejects only for
 * pre-conditions: `plan-stale`, `not-authenticated`, `offline`,
 * `download-in-progress`, `storage-unavailable`. Per-file failures, quota,
 * cancellation and an interruption are returned.
 */
export async function downloadSetlist(plan: DownloadPlan, opts: DownloadOptions = {}): Promise<DownloadResult> {
  const ctx = planContexts.get(plan);
  if (!ctx) throw new OfflineError("plan-stale", "This plan was not made by planDownload() on this page");
  if (authenticatedUserId() !== ctx.userId) throw new OfflineError("not-authenticated");
  if (isBrowserOffline()) throw new OfflineError("offline");
  if (Date.now() - ctx.createdAt > PLAN_MAX_AGE_MS) throw new OfflineError("plan-stale");
  if (activeJob) throw new OfflineError("download-in-progress");

  // Claimed synchronously, before any await, so two calls in this tab can't both start.
  const job = newJob(plan.setlistId, ctx.userId, ctx.pendingSnapshot.files, opts.signal);
  activeJob = job;
  let result: DownloadResult;
  try {
    await requireStoreForDownload();
    const existing = await readKey<OfflineDownloadJournal>(offlineKeys.download(plan.setlistId));
    if (existing && Date.parse(existing.startedAt) > ctx.createdAt) {
      throw new OfflineError("plan-stale", "A newer download of this setlist exists");
    }
    const outcome = await withDownloadLock(async () => {
      void maybeRequestPersistence();
      const journal: OfflineDownloadJournal = {
        schemaVersion: OFFLINE_SCHEMA_VERSION,
        setlistId: plan.setlistId,
        userId: ctx.userId,
        startedAt: new Date().toISOString(),
        plan,
        outcomes: {},
        pendingSnapshot: ctx.pendingSnapshot,
      };
      return runJob(job, journal, { fresh: true, onProgress: opts.onProgress });
    });
    if (outcome === LOCK_BUSY) throw new OfflineError("download-in-progress", "Another tab is downloading");
    result = outcome;
  } finally {
    if (activeJob === job) activeJob = null;
    job.dispose();
  }
  return refreshAfterCommit(plan.setlistId, result);
}

function newJob(
  setlistId: string,
  userId: string,
  files: OfflineFileRef[],
  signal?: AbortSignal
): DownloadJob & { dispose: () => void } {
  const controller = new AbortController();
  const job: DownloadJob & { dispose: () => void } = {
    setlistId,
    userId,
    controller,
    abortReason: null,
    wipesAtClaim: localWipeCount(),
    paths: new Set(files.map((f) => f.storagePath)),
    dispose: () => signal?.removeEventListener("abort", onAbort),
  };
  const onAbort = () => {
    job.abortReason ??= "cancel";
    controller.abort();
  };
  if (signal?.aborted) onAbort();
  signal?.addEventListener("abort", onAbort);
  return job;
}

/** The owner lost their valid session (or the device went offline) mid-download: race rule 2. */
class DownloadInterrupted extends Error {
  readonly code: "not-authenticated" | "offline";
  constructor(code: "not-authenticated" | "offline") {
    super(code);
    this.code = code;
  }
}

function interruption(job: DownloadJob): DownloadInterrupted | null {
  if (authenticatedUserId() !== job.userId) {
    // Same uid without a valid session is "offline-cached": offline, the journal waits.
    return new DownloadInterrupted(currentUserId === job.userId ? "offline" : "not-authenticated");
  }
  if (isBrowserOffline()) return new DownloadInterrupted("offline");
  return null;
}

function abortReasonOf(job: DownloadJob): DownloadJob["abortReason"] {
  return job.abortReason;
}

function isAbortError(error: unknown): boolean {
  return (error as { name?: unknown } | null)?.name === "AbortError";
}

function classifyStorageError(error: unknown): FailureReason {
  if (error instanceof FileFetchError) return error.reason;
  if (isNetworkError(error)) return "network";
  const { name, message, status, statusCode } = (error ?? {}) as {
    name?: unknown;
    message?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };
  // storage-js wraps a failed fetch in StorageUnknownError.
  if (name === "StorageUnknownError") return "network";
  if (typeof message === "string" && /not.?found/i.test(message)) return "not-found";
  const code = Number(status ?? statusCode);
  return Number.isFinite(code) && code > 0 ? classifyHttpStatus(code) : "unknown";
}

function missingFrom(
  ref: OfflineFileRef,
  reason: FailureReason,
  bytes: number | null
): OfflineMissingFile {
  return { storagePath: ref.storagePath, sheetMusicId: ref.sheetMusicId, songId: ref.songId, reason, bytes };
}

function currentFileLabel(snapshot: OfflineDownloadJournal["pendingSnapshot"], ref: OfflineFileRef) {
  const songTitle = snapshot.songsById[ref.songId]?.title ?? "";
  const name = snapshot.sheetMusicBySongId[ref.songId]?.find((sm) => sm.id === ref.sheetMusicId)?.name ?? "";
  return { songTitle, name };
}

const cancelledResult = (message: string): DownloadResult => ({
  state: "cancelled",
  meta: null,
  missingFiles: [],
  failure: new OfflineError("cancelled", message),
});

/**
 * The `downloading` and `committing` states (§4.1), shared by a new download
 * and a resume. `fresh`: the journal is written first; otherwise it exists and
 * its `stored` outcomes are skipped once their key is confirmed.
 */
async function runJob(
  job: DownloadJob,
  journal: OfflineDownloadJournal,
  opts: { fresh: boolean; onProgress?: (p: DownloadProgress) => void }
): Promise<DownloadResult> {
  const epoch = await readEpoch();
  const journalKey = offlineKeys.download(journal.setlistId);
  const snapshot = journal.pendingSnapshot;
  const outcomes: Record<string, Outcome> = { ...journal.outcomes };
  const knownBytes = new Map(journal.plan.filesToDownload.map((f) => [f.storagePath, f.bytes]));
  const wasWiped = () => job.abortReason === "wiped" || localWipeCount() !== job.wipesAtClaim;
  const writeJournal = (tx: StoreTx) => tx.put(journalKey, { ...journal, outcomes: { ...outcomes } });

  // A wipe between the claim and readEpoch() would hand us the new epoch: the
  // claim-time wipe count catches it in this tab, the owner check in another
  // (its sign-out reaches this tab as SIGNED_OUT). The session/network check
  // is per file fetch (below), not here: a job with nothing left to fetch
  // commits offline.
  if (wasWiped()) return cancelledResult("Offline copies were deleted");
  // (Through a call: TS would otherwise keep this narrowing across the awaits below.)
  if (abortReasonOf(job) === "cancel") return cancelledResult("Download cancelled");

  try {
    if (opts.fresh) {
      await transact("readwrite", async (tx) => writeJournal(tx), { epoch });
    }

    // With the journal in place GC keeps every file it names (race rule 3), so
    // a file seen now stays until commit. Check presence only after that write.
    const toFetch: OfflineFileRef[] = [];
    await transact("readonly", async (tx) => {
      for (const ref of snapshot.files) {
        const previous = outcomes[ref.storagePath];
        const present = await tx.has(offlineKeys.file(ref.storagePath));
        if (present && (opts.fresh || previous === "stored" || previous === "skipped-present")) {
          outcomes[ref.storagePath] = previous === "stored" ? "stored" : "skipped-present";
        } else {
          delete outcomes[ref.storagePath];
          toFetch.push(ref);
        }
      }
    });

    const progress: DownloadProgress = {
      state: "downloading",
      filesDone: 0,
      filesTotal: toFetch.length,
      bytesDone: 0,
      bytesTotal: toFetch.reduce((sum, f) => sum + (knownBytes.get(f.storagePath) ?? 0), 0),
      currentFile: null,
    };
    const report = () => {
      const copy = { ...progress };
      opts.onProgress?.(copy);
      emit({ type: "download-progress", setlistId: journal.setlistId, progress: copy });
    };
    report();

    // §4.5: after a file fails on quota, only smaller files are still tried.
    let quotaCeiling = Infinity;
    const failed: Record<string, number | null> = {};

    for (let i = 0; i < toFetch.length; i++) {
      const ref = toFetch[i];
      if (job.abortReason || wasWiped()) break;
      const interrupted = interruption(job);
      if (interrupted) {
        // Race rule 2: a fetch needs a signed URL, so a valid session and a
        // browser that says online. What is left is recorded as a network
        // failure and the journal stays for resume. Nothing is committed.
        // (navigator.onLine only: the context's forced-offline window after
        // one failed request must not skip the remaining files.)
        for (const rest of toFetch.slice(i)) outcomes[rest.storagePath] = "network";
        await transact("readwrite", async (tx) => writeJournal(tx), { epoch });
        return {
          state: "failed",
          meta: null,
          missingFiles: toFetch.slice(i).map((r) => missingFrom(r, "network", knownBytes.get(r.storagePath) ?? null)),
          failure: new OfflineError(interrupted.code, "The download was interrupted; it resumes from where it stopped"),
        };
      }

      progress.currentFile = currentFileLabel(snapshot, ref);
      report();
      const bytesBefore = progress.bytesDone;
      const expected = knownBytes.get(ref.storagePath) ?? null;
      let outcome: Outcome;
      let failedBytes: number | null = expected;

      if (expected !== null && expected >= quotaCeiling) {
        outcome = "quota";
      } else {
        try {
          const url = await createSheetMusicDownloadUrl(ref.storagePath);
          let announced: number | null = null;
          const blob = await fetchFileWithStallTimeout(url, {
            signal: job.controller.signal,
            onLength: (length) => {
              announced = length;
              return !(length !== null && length >= quotaCeiling);
            },
            onBytes: (received) => {
              progress.bytesDone = bytesBefore + received;
              report();
            },
          });
          if (!blob || blob.size >= quotaCeiling) {
            outcome = "quota";
            failedBytes = blob?.size ?? announced ?? expected;
          } else {
            outcomes[ref.storagePath] = "stored";
            const record: OfflineFileRecord = {
              storagePath: ref.storagePath,
              blob,
              bytes: blob.size,
              downloadedAt: new Date().toISOString(),
            };
            try {
              // The file and its outcome in one transaction (§4.3): a crash
              // can't leave a stored file the journal doesn't know about.
              await transact(
                "readwrite",
                async (tx) => {
                  tx.put(offlineKeys.file(ref.storagePath), record);
                  writeJournal(tx);
                },
                { epoch }
              );
              outcome = "stored";
            } catch (error) {
              delete outcomes[ref.storagePath];
              if (!isQuotaExceeded(error)) throw error;
              outcome = "quota";
              failedBytes = blob.size;
              quotaCeiling = Math.min(quotaCeiling, blob.size);
            }
          }
        } catch (error) {
          if (error instanceof StoreEpochChangedError) throw error;
          if (isAbortError(error) && job.abortReason) break;
          outcome = classifyStorageError(error);
          if (outcome === "unknown") console.error(`Offline download of ${ref.storagePath} failed:`, error);
        }
      }

      if (outcome !== "stored") {
        outcomes[ref.storagePath] = outcome;
        failed[ref.storagePath] = failedBytes;
        await transact("readwrite", async (tx) => writeJournal(tx), { epoch });
      }
      progress.filesDone++;
      progress.bytesDone = bytesBefore + (outcome === "stored" ? (knownBytes.get(ref.storagePath) ?? 0) : 0);
      progress.currentFile = null;
      report();
    }

    if (wasWiped()) return cancelledResult("Offline copies were deleted");
    if (job.abortReason === "cancel") {
      // §4.4: the journal goes, stored files stay for GC.
      await transact("readwrite", async (tx) => tx.delete(journalKey), { epoch }).catch((error: unknown) => {
        if (!(error instanceof StoreEpochChangedError)) throw error;
      });
      job.paths.clear(); // this job no longer protects its files
      await collectGarbage();
      return cancelledResult("Download cancelled");
    }

    progress.state = "committing";
    report();
    return await commit(job, journal, outcomes, failed, epoch);
  } catch (error) {
    if (error instanceof StoreEpochChangedError || wasWiped()) return cancelledResult("Offline copies were deleted");
    throw error;
  }
}

/**
 * The commit transaction (§4.3, §4.5): meta + snapshot + band written and the
 * journal deleted together, after checking every referenced file is present
 * (§3.5 #5). It is local, so it needs neither network nor a valid session:
 * only an unchanged epoch and the plan's owner as the current user (race
 * rule 2), so offline, "offline-cached" and a same-uid resume all commit. A
 * quota failure is retried once after GC; a second one is `quota-rows`.
 */
async function commit(
  job: DownloadJob,
  journal: OfflineDownloadJournal,
  outcomes: Record<string, Outcome>,
  failedBytes: Record<string, number | null>,
  epoch: string | null
): Promise<DownloadResult> {
  const snapshot = journal.pendingSnapshot;
  const setlistId = journal.setlistId;
  // Outside the transaction: awaiting anything but an IDB request inside one lets it commit early.
  const fingerprint = await fingerprintOf(snapshot);

  const attempt = () =>
    transact(
      "readwrite",
      async (tx) => {
        if (currentUserId !== job.userId) throw new DownloadInterrupted("not-authenticated");
        const previous = await tx.get<OfflineSnapshot>(offlineKeys.snapshot(setlistId));
        let bytes = 0;
        let fileCount = 0;
        const missingFiles: OfflineMissingFile[] = [];
        for (const ref of snapshot.files) {
          const record = await tx.get<OfflineFileRecord>(offlineKeys.file(ref.storagePath));
          if (record) {
            bytes += record.bytes;
            fileCount++;
            continue;
          }
          const outcome = outcomes[ref.storagePath];
          const reason: FailureReason =
            outcome && outcome !== "stored" && outcome !== "skipped-present" ? outcome : "unknown";
          missingFiles.push(missingFrom(ref, reason, failedBytes[ref.storagePath] ?? null));
        }
        const savedAt = new Date().toISOString();
        const meta: OfflineSnapshotMeta = {
          schemaVersion: OFFLINE_SCHEMA_VERSION,
          setlistId,
          bandId: snapshot.band.id,
          userId: job.userId,
          setlistName: snapshot.setlist.name,
          savedAt,
          completeness: missingFiles.length > 0 ? "partial" : "complete",
          bytes,
          fileCount,
          missingFiles,
          fingerprint,
          freshness: "unknown",
          lastCheckedAt: null,
          rowsUpdatedAt: savedAt,
          lastDiff: null,
          verifiedAt: null,
        };
        // Offline PDF choices not flushed yet survive a re-download (§5.6).
        const localPreferenceOverrides =
          previous && previous.userId === job.userId ? (previous.localPreferenceOverrides ?? {}) : {};
        tx.put(offlineKeys.snapshotMeta(setlistId), meta);
        tx.put(offlineKeys.snapshot(setlistId), { ...snapshot, localPreferenceOverrides });
        tx.put(offlineKeys.band(snapshot.band.id), snapshot.band);
        tx.delete(offlineKeys.download(setlistId));
        return { meta, replaced: !!previous };
      },
      { epoch }
    );

  let committed: { meta: OfflineSnapshotMeta; replaced: boolean };
  try {
    try {
      committed = await attempt();
    } catch (error) {
      if (!isQuotaExceeded(error)) throw error;
      await collectGarbage();
      committed = await attempt();
    }
  } catch (error) {
    if (error instanceof DownloadInterrupted) {
      return {
        state: "failed",
        meta: null,
        missingFiles: [],
        failure: new OfflineError(error.code, "Another user is current; the download was not saved"),
      };
    }
    if (!isQuotaExceeded(error)) throw error;
    // §4.5: the rows themselves don't fit. The journal goes; GC reclaims the files.
    await transact("readwrite", async (tx) => tx.delete(offlineKeys.download(setlistId)), { epoch }).catch(
      (deleteError: unknown) => {
        if (!(deleteError instanceof StoreEpochChangedError)) throw deleteError;
      }
    );
    job.paths.clear();
    await collectGarbage();
    return {
      state: "failed",
      meta: null,
      missingFiles: [],
      failure: new OfflineError("quota-rows", "Not enough space to save this setlist; remove another one", {
        cause: error,
      }),
    };
  }

  emit({ type: "snapshot-changed", setlistId });
  if (committed.replaced) await collectGarbage();
  const { meta } = committed;
  return {
    state: meta.completeness === "complete" ? "done" : "done-with-errors",
    meta,
    missingFiles: meta.missingFiles,
    failure: null,
  };
}

/** §6.1. Song timestamps are "" until `songs.updated_at` exists (§6.2, PR 3.0). */
async function fingerprintOf(snapshot: OfflineDownloadJournal["pendingSnapshot"]): Promise<OfflineFingerprint> {
  const songs = Object.values(snapshot.songsById)
    .map((song): [string, string] => [song.id, (song as { updated_at?: string }).updated_at ?? ""])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const sheetMusic = Object.values(snapshot.sheetMusicBySongId)
    .flat()
    .map((sm): [string, string, string, string] => [sm.id, sm.song_id, sm.updated_at ?? "", sm.file_url])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const base = { setlistUpdatedAt: snapshot.setlist.updated_at ?? "", songs, sheetMusic };
  return { ...base, hash: await hashOf(base) };
}

async function hashOf(base: Omit<OfflineFingerprint, "hash">): Promise<string> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(base)));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // No crypto.subtle (insecure context): the fields still compare.
    return "";
  }
}

/**
 * §4.4: for every interrupted download of the current user, resume it
 * (stored files are not fetched again; rows come from the journal), discard it
 * when older than 7 days (returned as `failed` / `plan-stale`). One that still
 * has files to fetch needs a valid session and the browser online, and is
 * left alone otherwise; one whose files are all stored just commits, offline
 * and in "offline-cached" too. Never rejects.
 */
export async function resumeInterruptedDownloads(): Promise<DownloadResult[]> {
  const userId = currentUserId;
  if (!userId || !(await storeReady())) return [];
  const results: DownloadResult[] = [];
  let discarded = false;
  try {
    for (const journal of await readOwnedJournals(userId)) {
      if (Date.now() - Date.parse(journal.startedAt) > JOURNAL_MAX_AGE_MS) {
        await removeKey(offlineKeys.download(journal.setlistId));
        discarded = true;
        results.push({
          state: "failed",
          meta: null,
          missingFiles: [],
          failure: new OfflineError("plan-stale", "The interrupted download is too old; download it again"),
        });
        continue;
      }
      if (activeJob || currentUserId !== userId) continue;
      const canFetch = !isBrowserOffline() && authenticatedUserId() === userId;
      if (!canFetch && (await hasFilesToFetch(journal))) continue;

      const job = newJob(journal.setlistId, userId, journal.pendingSnapshot.files);
      activeJob = job;
      let finished: DownloadResult | null = null;
      try {
        const outcome = await withDownloadLock(async () => {
          // Another tab may have finished or cancelled it while we waited.
          const current = await readKey<OfflineDownloadJournal>(offlineKeys.download(journal.setlistId));
          if (!current || current.startedAt !== journal.startedAt) return null;
          return runJob(job, current, { fresh: false });
        });
        if (outcome && outcome !== LOCK_BUSY) finished = outcome;
      } finally {
        if (activeJob === job) activeJob = null;
        job.dispose();
      }
      if (finished) results.push(await refreshAfterCommit(journal.setlistId, finished));
    }
  } catch (error) {
    console.error("Could not resume offline downloads:", error);
  }
  if (discarded) await collectGarbage();
  return results;
}

/** Whether some file of the journal is neither recorded as stored nor present (the same test runJob uses). */
async function hasFilesToFetch(journal: OfflineDownloadJournal): Promise<boolean> {
  return transact("readonly", async (tx) => {
    for (const ref of journal.pendingSnapshot.files) {
      const outcome = journal.outcomes[ref.storagePath];
      if (outcome !== "stored" && outcome !== "skipped-present") return true;
      if (!(await tx.has(offlineKeys.file(ref.storagePath)))) return true;
    }
    return false;
  });
}

async function readOwnedJournals(userId: string): Promise<OfflineDownloadJournal[]> {
  const journalKeys = keysWithPrefix(await readKeys(), OFFLINE_KEY_PREFIX.download);
  const journals: OfflineDownloadJournal[] = [];
  for (const value of await readMany<OfflineDownloadJournal>(journalKeys)) {
    if (!value || typeof value !== "object" || typeof value.setlistId !== "string") continue;
    if (!(await hasCurrentSchema(value))) return [];
    if (value.userId === userId) journals.push(value);
  }
  return journals;
}

/** Interrupted downloads of the current user, for the list UI. */
export function listInterruptedDownloads(): Promise<Array<{ setlistId: string; setlistName: string; startedAt: string }>> {
  const userId = currentUserId;
  if (!userId) return Promise.resolve([]);
  return safeRead([], async () =>
    (await readOwnedJournals(userId))
      .filter((j) => activeJob?.setlistId !== j.setlistId)
      .map((j) => ({ setlistId: j.setlistId, setlistName: j.pendingSnapshot?.setlist?.name ?? "", startedAt: j.startedAt }))
  );
}

/**
 * Cancels the running download of `setlistId` (its fetch is aborted, the
 * journal deleted, stored files left for GC). With no running download, it
 * discards that setlist's interrupted download of the current user instead
 * ("Discard", PR 3.4).
 */
export function cancelDownload(setlistId: string): void {
  if (activeJob?.setlistId === setlistId) {
    abortActiveDownload("cancel");
    return;
  }
  const userId = currentUserId;
  if (!userId) return;
  void safeRead(undefined, async () => {
    const journal = await readKey<OfflineDownloadJournal>(offlineKeys.download(setlistId));
    if (!journal || journal.userId !== userId) return;
    await removeKey(offlineKeys.download(setlistId));
    await collectGarbage();
  });
}

/** Removes the current user's snapshot of `setlistId`, then GC reclaims files nothing else references. */
export async function removeSnapshot(setlistId: string): Promise<void> {
  const userId = currentUserId;
  if (!userId || !(await storeReady())) return;
  const removed = await transact("readwrite", async (tx) => {
    const meta = await tx.get<OfflineSnapshotMeta>(offlineKeys.snapshotMeta(setlistId));
    const snapshot = await tx.get<OfflineSnapshot>(offlineKeys.snapshot(setlistId));
    const owner = meta?.userId ?? snapshot?.userId;
    if (owner !== userId) return false;
    tx.delete(offlineKeys.snapshotMeta(setlistId));
    tx.delete(offlineKeys.snapshot(setlistId));
    // The band row goes with the last snapshot (of any user) that names it.
    const bandId = meta?.bandId ?? snapshot?.band?.id;
    if (bandId !== undefined) {
      const otherMetas = keysWithPrefix(await tx.keys(), OFFLINE_KEY_PREFIX.snapshotMeta).filter(
        (k) => k !== offlineKeys.snapshotMeta(setlistId)
      );
      let bandUsed = false;
      for (const key of otherMetas) {
        if ((await tx.get<OfflineSnapshotMeta>(key))?.bandId === bandId) bandUsed = true;
      }
      if (!bandUsed) tx.delete(offlineKeys.band(bandId));
    }
    return true;
  });
  if (!removed) return;
  emit({ type: "snapshot-changed", setlistId });
  await collectGarbage();
}

/**
 * §4.6: deletes every `file:` key that no `snapshot:` and no `download:`
 * journal references, **whatever its userId** (hidden users' files survive).
 * One readwrite transaction, so it can't interleave with a download's writes
 * in any tab (race rule 3); files the running download of this tab may still
 * store are kept too. Never rejects.
 */
export async function collectGarbage(): Promise<{ deletedFiles: number; freedBytes: number }> {
  if (!(await storeReady())) return { deletedFiles: 0, freedBytes: 0 };
  try {
    return await transact("readwrite", async (tx) => {
      const all = await tx.keys();
      const referenced = new Set<string>(activeJob?.paths ?? []);
      for (const key of keysWithPrefix(all, OFFLINE_KEY_PREFIX.snapshot)) {
        const snapshot = await tx.get<OfflineSnapshot>(key);
        for (const f of snapshot?.files ?? []) referenced.add(f.storagePath);
      }
      for (const key of keysWithPrefix(all, OFFLINE_KEY_PREFIX.download)) {
        const journal = await tx.get<OfflineDownloadJournal>(key);
        for (const f of journal?.pendingSnapshot?.files ?? []) referenced.add(f.storagePath);
        for (const f of journal?.plan?.filesToDownload ?? []) referenced.add(f.storagePath);
        for (const f of journal?.plan?.filesAlreadyPresent ?? []) referenced.add(f.storagePath);
      }
      let deletedFiles = 0;
      let freedBytes = 0;
      for (const key of keysWithPrefix(all, OFFLINE_KEY_PREFIX.file)) {
        if (referenced.has(key.slice(OFFLINE_KEY_PREFIX.file.length))) continue;
        const record = await tx.get<OfflineFileRecord>(key);
        freedBytes += record?.bytes ?? 0;
        deletedFiles++;
        tx.delete(key);
      }
      const meta = await tx.get<OfflineStoreMeta>(offlineKeys.meta);
      if (meta) tx.put(offlineKeys.meta, { ...meta, lastGcAt: new Date().toISOString() });
      return { deletedFiles, freedBytes };
    });
  } catch (error) {
    console.error("Offline garbage collection failed:", error);
    return { deletedFiles: 0, freedBytes: 0 };
  }
}

/** navigator.storage.persist(), recorded in meta.persisted. null when unsupported. Never rejects. */
export async function requestPersistence(): Promise<boolean | null> {
  const storage = typeof navigator !== "undefined" ? navigator.storage : undefined;
  if (!storage?.persist) return null;
  let persisted: boolean;
  try {
    persisted = await storage.persist();
  } catch (error) {
    console.warn("navigator.storage.persist() failed:", error);
    return null;
  }
  if (await storeReady()) {
    await transact("readwrite", async (tx) => {
      const meta = await tx.get<OfflineStoreMeta>(offlineKeys.meta);
      if (meta) tx.put(offlineKeys.meta, { ...meta, persisted });
    }).catch((error: unknown) => console.error("Could not record storage persistence:", error));
  }
  return persisted;
}

/** §4.1: the first download on the device asks for persistent storage (not awaited: Firefox prompts). */
async function maybeRequestPersistence(): Promise<void> {
  try {
    const meta = await readKey<OfflineStoreMeta>(offlineKeys.meta);
    if (meta && meta.persisted === null) await requestPersistence();
  } catch (error) {
    console.warn("Could not request storage persistence:", error);
  }
}

export async function getStorageUsage(): Promise<{
  usage: number | null;
  quota: number | null;
  persisted: boolean | null;
  bySetlist: Array<{ setlistId: string; bytes: number }>;
  distinctFileBytes: number;
}> {
  const estimate = await storageEstimate();
  const empty = { usage: estimate?.usage ?? null, quota: estimate?.quota ?? null, persisted: null, bySetlist: [], distinctFileBytes: 0 };
  const userId = currentUserId;
  return safeRead(empty, async () => {
    const meta = await readKey<OfflineStoreMeta>(offlineKeys.meta);
    const metas = userId ? await readOwnedMetas(userId) : [];
    const paths = new Set<string>();
    for (const m of metas) {
      const snapshot = await readKey<OfflineSnapshot>(offlineKeys.snapshot(m.setlistId));
      for (const f of snapshot?.files ?? []) paths.add(f.storagePath);
    }
    let distinctFileBytes = 0;
    // One file record at a time: never load every blob at once (§3.3).
    for (const path of paths) distinctFileBytes += (await readKey<OfflineFileRecord>(offlineKeys.file(path)))?.bytes ?? 0;
    return {
      ...empty,
      persisted: meta?.persisted ?? null,
      bySetlist: metas.map((m) => ({ setlistId: m.setlistId, bytes: m.bytes })),
      distinctFileBytes,
    };
  });
}

// ---------------------------------------------------------------------------
// Row refresh and perform-mode write-through (A3, §5.2, §5.6; PR 2.4)
// ---------------------------------------------------------------------------

export interface RowRefreshResult {
  /**
   * "skipped": nothing was fetched or written because there is no snapshot of
   * the current user, a download of this setlist is running or interrupted
   * (its commit would overwrite newer rows, §4.3), or a perform-mode write
   * landed while the rows were being fetched (it wins; the next open refreshes).
   */
  status: "unchanged" | "updated" | "deleted" | "failed" | "skipped";
  /** Refs the new rows reference that are not in the store (reason "not-downloaded"). */
  filesNotDownloaded: OfflineFileRef[];
  /** Refs the old rows had and the new ones do not; GC runs after commit. */
  filesReleased: OfflineFileRef[];
}

const refreshResult = (status: RowRefreshResult["status"]): RowRefreshResult => ({
  status,
  filesNotDownloaded: [],
  filesReleased: [],
});

function isSetlistGone(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "PGRST116";
}

/**
 * Special items that were never saved with an id get a new random id on every
 * read (`normalizeSetlistItem`). Give them back the id the snapshot already
 * has for the same item (type + label, first unused match), so a refresh of
 * an unchanged setlist compares equal and the view keeps its current item.
 */
function adoptItemIds(previous: Setlist, next: Setlist): Setlist {
  const known = new Set((next.songs || []).map((item) => item.id).filter(Boolean));
  const unused = (previous.songs || []).filter((item) => !isSongItem(item) && item.id && !known.has(item.id));
  if (unused.length === 0) return next;
  let adopted = false;
  const songs = (next.songs || []).map((item) => {
    if (isSongItem(item) || (item.id && (previous.songs || []).some((p) => p.id === item.id))) return item;
    const index = unused.findIndex((p) => p.type === item.type && !isSongItem(p) && p.label === item.label);
    if (index < 0) return item;
    const [match] = unused.splice(index, 1);
    adopted = true;
    return { ...item, id: match.id };
  });
  return adopted ? { ...next, songs } : next;
}

/** The snapshot rows as the server has them now. Rejects on any fetch failure but the (optional) preferences. */
async function fetchSnapshotRows(setlistId: string, userId: string) {
  const setlist = await getSetlist(setlistId);
  const songIds = referencedSongIds(setlist);
  const [songs, sheetMusicBySongId, preferredSheetMusicIds, band] = await Promise.all([
    getSongsByIds(songIds),
    getSheetMusicForSongs(songIds),
    // A failed preference read keeps the snapshot's (null), never erases them.
    getMySheetMusicPreferences(songIds).catch((error: unknown) => {
      console.error("Offline refresh: could not load sheet music preferences:", error);
      return null;
    }),
    getMyBands(userId).then((bands) => bands.find((b) => b.id === setlist.band_id) ?? null),
  ]);
  const songsById: Record<string, Song> = {};
  for (const song of songs) songsById[song.id] = song;
  return { setlist, songsById, sheetMusicBySongId, preferredSheetMusicIds, band };
}

/**
 * A3 (§5.2, §8.2): fetches the setlist, its referenced songs, their
 * `song_sheet_music` rows, the user's preferences and the band row, and when
 * any differ from the snapshot commits them in one transaction (snapshot +
 * snapshot-meta + band). Never fetches a PDF: files the new rows reference
 * but the store lacks become `missingFiles` with reason "not-downloaded" and
 * set freshness to "outdated"; files the old rows referenced and the new ones
 * don't are released to GC. `localPreferenceOverrides` are kept (they win).
 *
 * "deleted": the setlist row is gone (or RLS hides it) → freshness "deleted",
 * rows kept (D5). "failed": network or server error, nothing written.
 * Rejects only with OfflineError("not-authenticated") without a valid session.
 */
export async function refreshSnapshotRows(setlistId: string): Promise<RowRefreshResult> {
  const userId = authenticatedUserId();
  if (!userId) throw new OfflineError("not-authenticated");
  if (isBrowserOffline() || !(await storeReady())) return refreshResult("failed");
  if (activeJob?.setlistId === setlistId) return refreshResult("skipped");

  let before: { meta: OfflineSnapshotMeta; snapshot: OfflineSnapshot } | null;
  let epoch: string | null;
  try {
    before = await readOwnedPair(setlistId, userId);
    if (!before || (await readKey(offlineKeys.download(setlistId)))) return refreshResult("skipped");
    epoch = await readEpoch();
  } catch (error) {
    console.error("Offline refresh: could not read the snapshot:", error);
    return refreshResult("failed");
  }

  let fetched: Awaited<ReturnType<typeof fetchSnapshotRows>>;
  try {
    fetched = await fetchSnapshotRows(setlistId, userId);
  } catch (error) {
    if (isSetlistGone(error)) return markSnapshotDeleted(setlistId, userId, before.meta.rowsUpdatedAt, epoch);
    console.warn("Offline refresh failed; the snapshot stays as it is:", error);
    return refreshResult("failed");
  }

  const old = before.snapshot;
  const setlist = adoptItemIds(old.setlist, fetched.setlist);
  const files = fileRefsOf(setlist, fetched.sheetMusicBySongId);
  const rows = {
    band: fetched.band ?? old.band,
    setlist,
    songsById: fetched.songsById,
    sheetMusicBySongId: fetched.sheetMusicBySongId,
    preferredSheetMusicIds: fetched.preferredSheetMusicIds ?? old.preferredSheetMusicIds,
    files,
  };
  const rowsChanged =
    !deepEqual(rows.band, old.band) ||
    !deepEqual(rows.setlist, old.setlist) ||
    !deepEqual(rows.songsById, old.songsById) ||
    !deepEqual(rows.sheetMusicBySongId, old.sheetMusicBySongId) ||
    !deepEqual(rows.preferredSheetMusicIds, old.preferredSheetMusicIds) ||
    !deepEqual(rows.files, old.files);
  const newPaths = new Set(files.map((f) => f.storagePath));
  const filesReleased = old.files.filter((f) => !newPaths.has(f.storagePath));
  const fingerprint = rowsChanged ? await fingerprintOf({ ...old, ...rows }) : before.meta.fingerprint;

  let committed: { status: "updated" | "unchanged" | "skipped"; filesNotDownloaded: OfflineFileRef[] };
  try {
    committed = await transact(
      "readwrite",
      async (tx) => {
        const skipped = { status: "skipped" as const, filesNotDownloaded: [] };
        if (currentUserId !== userId) return skipped;
        if (await tx.has(offlineKeys.download(setlistId))) return skipped;
        const meta = await tx.get<OfflineSnapshotMeta>(offlineKeys.snapshotMeta(setlistId));
        const snapshot = await tx.get<OfflineSnapshot>(offlineKeys.snapshot(setlistId));
        if (!meta || !snapshot || meta.userId !== userId || snapshot.userId !== userId) return skipped;
        // A perform-mode patch (or a download) committed since we read: its rows win.
        if (meta.rowsUpdatedAt !== before.meta.rowsUpdatedAt) return skipped;

        const previousReasons = new Map(meta.missingFiles.map((m) => [m.storagePath, m] as const));
        const missingFiles: OfflineMissingFile[] = [];
        const filesNotDownloaded: OfflineFileRef[] = [];
        let bytes = 0;
        let fileCount = 0;
        for (const ref of files) {
          const record = await tx.get<OfflineFileRecord>(offlineKeys.file(ref.storagePath));
          if (record) {
            bytes += record.bytes;
            fileCount++;
            continue;
          }
          const previous = previousReasons.get(ref.storagePath);
          if (previous && previous.reason !== "not-downloaded") {
            missingFiles.push({ ...missingFrom(ref, previous.reason, previous.bytes) });
          } else {
            missingFiles.push(missingFrom(ref, "not-downloaded", null));
            filesNotDownloaded.push(ref);
          }
        }
        const now = new Date().toISOString();
        const nextMeta: OfflineSnapshotMeta = {
          ...meta,
          setlistName: rows.setlist.name,
          bandId: rows.band.id,
          completeness: missingFiles.some((m) => m.reason !== "not-downloaded") ? "partial" : "complete",
          bytes,
          fileCount,
          missingFiles,
          fingerprint,
          freshness: filesNotDownloaded.length > 0 ? "outdated" : "fresh",
          lastCheckedAt: now,
          rowsUpdatedAt: rowsChanged ? now : meta.rowsUpdatedAt,
        };
        tx.put(offlineKeys.snapshotMeta(setlistId), nextMeta);
        if (rowsChanged) {
          // Overrides chosen offline (and not flushed) still win over server preferences (§5.6).
          tx.put(offlineKeys.snapshot(setlistId), {
            ...snapshot,
            ...rows,
            localPreferenceOverrides: snapshot.localPreferenceOverrides ?? {},
          });
          tx.put(offlineKeys.band(rows.band.id), rows.band);
        }
        return { status: rowsChanged ? ("updated" as const) : ("unchanged" as const), filesNotDownloaded };
      },
      { epoch }
    );
  } catch (error) {
    if (!(error instanceof StoreEpochChangedError)) console.error("Offline refresh: could not save the rows:", error);
    return refreshResult(error instanceof StoreEpochChangedError ? "skipped" : "failed");
  }

  if (committed.status === "skipped") return refreshResult("skipped");
  emit({ type: "snapshot-changed", setlistId });
  const released = committed.status === "updated" ? filesReleased : [];
  if (released.length > 0) await collectGarbage();
  return { status: committed.status, filesNotDownloaded: committed.filesNotDownloaded, filesReleased: released };
}

async function markSnapshotDeleted(
  setlistId: string,
  userId: string,
  rowsUpdatedAt: string,
  epoch: string | null
): Promise<RowRefreshResult> {
  try {
    const marked = await transact(
      "readwrite",
      async (tx) => {
        const meta = await tx.get<OfflineSnapshotMeta>(offlineKeys.snapshotMeta(setlistId));
        if (currentUserId !== userId || !meta || meta.userId !== userId || meta.rowsUpdatedAt !== rowsUpdatedAt) return false;
        tx.put(offlineKeys.snapshotMeta(setlistId), { ...meta, freshness: "deleted", lastCheckedAt: new Date().toISOString() });
        return true;
      },
      { epoch }
    );
    if (!marked) return refreshResult("skipped");
  } catch (error) {
    if (!(error instanceof StoreEpochChangedError)) console.error("Offline refresh: could not mark the snapshot deleted:", error);
    return refreshResult("skipped");
  }
  emit({ type: "snapshot-changed", setlistId });
  return refreshResult("deleted");
}

/**
 * §4.3: every download commit is followed by one row refresh (a resumed
 * journal can carry rows up to 7 days old). Returns the result with the meta
 * as it is after the refresh (freshness, lastCheckedAt). Offline or without a
 * session it is skipped; the next perform-mode open refreshes.
 */
async function refreshAfterCommit(setlistId: string, result: DownloadResult): Promise<DownloadResult> {
  if (!result.meta || isBrowserOffline() || !authenticatedUserId()) return result;
  try {
    const refreshed = await refreshSnapshotRows(setlistId);
    if (refreshed.status === "failed" || refreshed.status === "skipped") return result;
    const meta = await getSnapshotMeta(setlistId);
    return meta ? { ...result, meta, missingFiles: meta.missingFiles } : result;
  } catch (error) {
    console.warn("Offline refresh after download failed:", error);
    return result;
  }
}

/**
 * Applies `change` to the current user's snapshot of `setlistId` in one
 * transaction. No snapshot (or another user's) → no-op. Never rejects: a
 * failure is logged and the next open's row refresh catches up (§5.2).
 */
async function patchSnapshot(
  setlistId: string,
  what: string,
  change: (
    snapshot: OfflineSnapshot,
    meta: OfflineSnapshotMeta
  ) => { snapshot: OfflineSnapshot; meta?: OfflineSnapshotMeta; deleteKeys?: string[] } | null
): Promise<boolean> {
  const userId = currentUserId;
  if (!userId) return false;
  try {
    if (!(await storeReady())) return false;
    const epoch = await readEpoch();
    const patched = await transact(
      "readwrite",
      async (tx) => {
        const meta = await tx.get<OfflineSnapshotMeta>(offlineKeys.snapshotMeta(setlistId));
        const snapshot = await tx.get<OfflineSnapshot>(offlineKeys.snapshot(setlistId));
        if (currentUserId !== userId || !meta || !snapshot || meta.userId !== userId || snapshot.userId !== userId) return false;
        if (meta.schemaVersion !== OFFLINE_SCHEMA_VERSION || snapshot.schemaVersion !== OFFLINE_SCHEMA_VERSION) return false;
        const next = change(snapshot, meta);
        if (!next) return false;
        tx.put(offlineKeys.snapshot(setlistId), next.snapshot);
        if (next.meta) tx.put(offlineKeys.snapshotMeta(setlistId), next.meta);
        for (const key of next.deleteKeys ?? []) tx.delete(key);
        return true;
      },
      { epoch }
    );
    if (patched) emit({ type: "snapshot-changed", setlistId });
    return patched;
  } catch (error) {
    if (!(error instanceof StoreEpochChangedError)) console.error(`Could not ${what} in the offline copy:`, error);
    return false;
  }
}

/**
 * After a successful server write from performance mode (reorder): replace
 * the snapshot's setlist row, normalized, and move `fingerprint.setlistUpdatedAt`
 * with it so the user's own write is not seen as a change (§8.2). Never rejects.
 */
export async function patchSnapshotSetlist(setlistId: string, setlist: Setlist): Promise<void> {
  const normalized: Setlist = { ...setlist, songs: normalizeSetlistItems(setlist.songs || []) };
  const current = await getSnapshotMeta(setlistId);
  if (!current) return;
  const base = { ...current.fingerprint, setlistUpdatedAt: normalized.updated_at ?? current.fingerprint.setlistUpdatedAt };
  const fingerprint = { ...base, hash: await hashOf({ setlistUpdatedAt: base.setlistUpdatedAt, songs: base.songs, sheetMusic: base.sheetMusic }) };
  await patchSnapshot(setlistId, "save the new order", (snapshot, meta) => ({
    snapshot: { ...snapshot, setlist: normalized },
    meta: { ...meta, setlistName: normalized.name, fingerprint, rowsUpdatedAt: new Date().toISOString() },
  }));
}

/**
 * After a successful setMySheetMusicPreference online: record it in
 * `preferredSheetMusicIds` (and drop an override for that song, which the
 * server write supersedes), so the choice survives going offline. Never rejects.
 */
export async function patchSnapshotPreference(setlistId: string, songId: string, sheetMusicId: string): Promise<void> {
  await patchSnapshot(setlistId, "save the PDF choice", (snapshot, meta) => {
    const overrides = { ...(snapshot.localPreferenceOverrides ?? {}) };
    delete overrides[songId];
    return {
      snapshot: {
        ...snapshot,
        preferredSheetMusicIds: { ...snapshot.preferredSheetMusicIds, [songId]: sheetMusicId },
        localPreferenceOverrides: overrides,
      },
      meta: { ...meta, rowsUpdatedAt: new Date().toISOString() },
    };
  });
}

/**
 * §9.3: a stored PDF whose blob is absent or unreadable (zero-length after
 * partial eviction) is recorded in `missingFiles` (reason "unknown",
 * completeness "partial"). Only the snapshot source calls it, from
 * resolvePdfUrl, and only online: then `deleteFile` removes the `file:`
 * record so the next download or Retry fetches it again instead of counting
 * it as present. Offline nothing is written (the session just treats the PDF
 * as unavailable), so a transient read failure never persists mid-show. A
 * pdf.js failure on a readable blob is never reported here. Never rejects.
 */
export async function markSnapshotFileMissing(
  setlistId: string,
  storagePath: string,
  opts: { deleteFile?: boolean } = {}
): Promise<void> {
  await patchSnapshot(setlistId, "record a missing file", (snapshot, meta) => {
    const ref = snapshot.files.find((f) => f.storagePath === storagePath);
    if (!ref || meta.missingFiles.some((m) => m.storagePath === storagePath)) return null;
    return {
      snapshot,
      meta: {
        ...meta,
        completeness: "partial",
        missingFiles: [...meta.missingFiles, missingFrom(ref, "unknown", null)],
        fileCount: Math.max(0, meta.fileCount - 1),
      },
      deleteKeys: opts.deleteFile ? [offlineKeys.file(storagePath)] : [],
    };
  });
}

/**
 * §5.6, offline: remember a PDF choice in the snapshot only
 * (`localPreferenceOverrides`), for the next flush. Works without a valid
 * session (the owner is the current user). Never rejects.
 */
export async function recordLocalPreference(setlistId: string, songId: string, sheetMusicId: string): Promise<void> {
  await patchSnapshot(setlistId, "remember the PDF choice", (snapshot) =>
    snapshot.localPreferenceOverrides?.[songId] === sheetMusicId
      ? null
      : { snapshot: { ...snapshot, localPreferenceOverrides: { ...snapshot.localPreferenceOverrides, [songId]: sheetMusicId } } }
  );
}

/**
 * §5.6, online: pushes `localPreferenceOverrides` with setMySheetMusicPreference,
 * best effort, one song at a time. Each one that succeeds moves from the
 * overrides into `preferredSheetMusicIds` (unless it changed meanwhile); a
 * failure keeps it for the next attempt. Needs a valid session and the browser
 * online, else does nothing. Never rejects, never toasts.
 */
export async function flushLocalPreferences(setlistId: string): Promise<void> {
  if (!authenticatedUserId() || isBrowserOffline()) return;
  const snapshot = await getSnapshot(setlistId);
  const overrides = Object.entries(snapshot?.localPreferenceOverrides ?? {});
  if (overrides.length === 0) return;
  const flushed: Array<[songId: string, sheetMusicId: string]> = [];
  for (const [songId, sheetMusicId] of overrides) {
    try {
      await setMySheetMusicPreference(songId, sheetMusicId);
      flushed.push([songId, sheetMusicId]);
    } catch (error) {
      console.warn("Could not save an offline PDF choice; it stays for the next attempt:", error);
      if (isNetworkError(error)) break;
    }
  }
  if (flushed.length === 0) return;
  await patchSnapshot(setlistId, "record the flushed PDF choices", (current) => {
    const remaining = { ...(current.localPreferenceOverrides ?? {}) };
    const preferred = { ...current.preferredSheetMusicIds };
    for (const [songId, sheetMusicId] of flushed) {
      if (remaining[songId] !== sheetMusicId) continue;
      delete remaining[songId];
      preferred[songId] = sheetMusicId;
    }
    return { snapshot: { ...current, preferredSheetMusicIds: preferred, localPreferenceOverrides: remaining } };
  });
}

/** Test-only: reset module state between tests. */
export function __resetOfflineServiceForTests(): void {
  currentUserId = null;
  currentUserAuthenticated = false;
  activeJob = null;
  ownedMetasPrefetch = null;
  schemaWipeAnnounced = false;
  authQueue = Promise.resolve();
  listeners.clear();
}
