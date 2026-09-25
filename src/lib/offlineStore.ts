import type { UseStore } from "idb-keyval";
import { createStore, del, delMany, get, getMany, keys, promisifyRequest, set, setMany } from "idb-keyval";

/**
 * IndexedDB layout behind offlineSetlistService (spec §3.3). Private to the
 * service: components and hooks never import this file or idb-keyval.
 *
 * One database, one object store, string keys with a type prefix (idb-keyval
 * can only create a store at database version 1, so prefixes replace extra
 * stores).
 */

/** Bump when any stored shape changes. Old versions are wiped, not migrated (§3.5 #2). */
export const OFFLINE_SCHEMA_VERSION = 1 as const;

export const OFFLINE_DB_NAME = "bandmate-offline";
export const OFFLINE_STORE_NAME = "kv";

export const OFFLINE_KEY_PREFIX = {
  band: "band:",
  snapshotMeta: "snapshot-meta:",
  snapshot: "snapshot:",
  file: "file:",
  download: "download:",
} as const;

export const offlineKeys = {
  meta: "meta",
  lastUser: "last-user",
  schemaWipeNotice: "schema-wipe-notice",
  band: (bandId: number | string) => `${OFFLINE_KEY_PREFIX.band}${bandId}`,
  snapshotMeta: (setlistId: string) => `${OFFLINE_KEY_PREFIX.snapshotMeta}${setlistId}`,
  snapshot: (setlistId: string) => `${OFFLINE_KEY_PREFIX.snapshot}${setlistId}`,
  file: (storagePath: string) => `${OFFLINE_KEY_PREFIX.file}${storagePath}`,
  download: (setlistId: string) => `${OFFLINE_KEY_PREFIX.download}${setlistId}`,
} as const;

/** Written once per device; guards every read. */
export interface OfflineStoreMeta {
  schemaVersion: typeof OFFLINE_SCHEMA_VERSION;
  /** Result of the last navigator.storage.persist() call, or null if never asked. */
  persisted: boolean | null;
  /** ISO timestamp of the last successful garbage collection (§4.6). */
  lastGcAt: string | null;
}

export interface OfflineSchemaWipeLostEntry {
  userId: string;
  setlistId: string;
  setlistName: string;
  bandId: number | null;
}

/** Written by a schema-mismatch wipe (§3.5 #2); read once per user, then dismissed. */
export interface OfflineSchemaWipeNotice {
  wipedAt: string;
  /** null when meta was missing/unreadable. */
  fromVersion: number | null;
  toVersion: typeof OFFLINE_SCHEMA_VERSION;
  /** Only this user's entries are ever shown to them (§3.5 #1). */
  lost: OfflineSchemaWipeLostEntry[];
  /** userIds that have dismissed it; the key is deleted once every userId in `lost` has. */
  dismissedBy: string[];
}

export type OfflineStoreOpenResult =
  | { status: "ready"; meta: OfflineStoreMeta; schemaWipe: OfflineSchemaWipeNotice | null }
  | { status: "unavailable"; error: unknown };

let storeHandle: UseStore | null = null;
let openPromise: Promise<OfflineStoreOpenResult> | null = null;

function newMeta(): OfflineStoreMeta {
  return { schemaVersion: OFFLINE_SCHEMA_VERSION, persisted: null, lastGcAt: null };
}

/**
 * The one cross-version contract (§3.1): a snapshot-meta of any schema keeps
 * `setlistId`, `setlistName`, `userId` (and `bandId` when present) with the
 * same names and types. Nothing else of an old record is trusted.
 */
function toLostEntry(value: unknown): OfflineSchemaWipeLostEntry | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const { setlistId, setlistName, userId, bandId } = record;
  if (typeof setlistId !== "string" || typeof userId !== "string") return null;
  return {
    userId,
    setlistId,
    setlistName: typeof setlistName === "string" ? setlistName : "",
    bandId: typeof bandId === "number" ? bandId : null,
  };
}

function mergeLost(
  previous: OfflineSchemaWipeLostEntry[],
  next: OfflineSchemaWipeLostEntry[]
): OfflineSchemaWipeLostEntry[] {
  const byKey = new Map<string, OfflineSchemaWipeLostEntry>();
  for (const entry of [...previous, ...next]) byKey.set(`${entry.userId}\u0000${entry.setlistId}`, entry);
  return [...byKey.values()];
}

function isValidNotice(value: unknown): value is OfflineSchemaWipeNotice {
  return !!value && typeof value === "object" && Array.isArray((value as OfflineSchemaWipeNotice).lost);
}

/**
 * Wipes a store whose schema does not match (§3.5 #2). Collects what was lost
 * from `snapshot-meta:*` first, keeps `last-user` (not an auth event), and
 * rewrites meta + notice in the same transaction as the clear, so an
 * interruption can't leave a cleared store without its notice.
 */
async function wipeForSchema(
  store: UseStore,
  fromVersion: number | null
): Promise<{ meta: OfflineStoreMeta; notice: OfflineSchemaWipeNotice | null }> {
  const allKeys = await keys<string>(store);
  const metaKeys = allKeys.filter((k) => typeof k === "string" && k.startsWith(OFFLINE_KEY_PREFIX.snapshotMeta));
  const [metaValues, lastUser, previousNotice] = await Promise.all([
    getMany(metaKeys, store),
    get<unknown>(offlineKeys.lastUser, store),
    get<unknown>(offlineKeys.schemaWipeNotice, store),
  ]);
  const lost = metaValues.map(toLostEntry).filter((e): e is OfflineSchemaWipeLostEntry => e !== null);

  const meta = newMeta();
  const mergedLost = mergeLost(isValidNotice(previousNotice) ? previousNotice.lost : [], lost);
  const notice: OfflineSchemaWipeNotice | null =
    mergedLost.length > 0
      ? {
          wipedAt: new Date().toISOString(),
          fromVersion,
          toVersion: OFFLINE_SCHEMA_VERSION,
          lost: mergedLost,
          dismissedBy: isValidNotice(previousNotice) ? previousNotice.dismissedBy ?? [] : [],
        }
      : null;

  await store("readwrite", (s) => {
    s.clear();
    s.put(meta, offlineKeys.meta);
    if (typeof lastUser === "string") s.put(lastUser, offlineKeys.lastUser);
    if (notice) s.put(notice, offlineKeys.schemaWipeNotice);
    return promisifyRequest(s.transaction);
  });
  return { meta, notice };
}

async function doOpen(): Promise<OfflineStoreOpenResult> {
  try {
    if (typeof indexedDB === "undefined") throw new Error("IndexedDB is not available");
    const store = createStore(OFFLINE_DB_NAME, OFFLINE_STORE_NAME);
    const stored = await get<unknown>(offlineKeys.meta, store);
    const storedVersion =
      stored && typeof stored === "object" && typeof (stored as OfflineStoreMeta).schemaVersion === "number"
        ? (stored as OfflineStoreMeta).schemaVersion
        : null;

    if (storedVersion === OFFLINE_SCHEMA_VERSION) {
      storeHandle = store;
      return { status: "ready", meta: stored as OfflineStoreMeta, schemaWipe: null };
    }

    const existingKeys = await keys<string>(store);
    if (stored === undefined && existingKeys.length === 0) {
      // First open on this device: nothing to wipe, nothing lost.
      const meta = newMeta();
      await set(offlineKeys.meta, meta, store);
      storeHandle = store;
      return { status: "ready", meta, schemaWipe: null };
    }

    const { meta, notice } = await wipeForSchema(store, storedVersion);
    storeHandle = store;
    return { status: "ready", meta, schemaWipe: notice };
  } catch (error) {
    storeHandle = null;
    return { status: "unavailable", error };
  }
}

/** Opens the store once per page load and runs the schema guard. Never rejects. */
export function openStore(): Promise<OfflineStoreOpenResult> {
  if (!openPromise) openPromise = doOpen();
  return openPromise;
}

/**
 * Re-runs the schema wipe on an open store, for a record found with a
 * different `schemaVersion` than the meta promised (§3.5 #2).
 */
export async function wipeStoreForSchema(fromVersion: number | null): Promise<OfflineSchemaWipeNotice | null> {
  const store = requireStore();
  const { notice } = await wipeForSchema(store, fromVersion);
  return notice;
}

function requireStore(): UseStore {
  if (!storeHandle) throw new Error("Offline store is not open");
  return storeHandle;
}

export function readKey<T>(key: string): Promise<T | undefined> {
  return get<T>(key, requireStore());
}

export function readMany<T>(keyList: string[]): Promise<(T | undefined)[]> {
  return getMany<T>(keyList, requireStore());
}

export async function readKeys(): Promise<string[]> {
  const all = await keys(requireStore());
  return all.filter((k): k is string => typeof k === "string");
}

export function writeKey(key: string, value: unknown): Promise<void> {
  return set(key, value, requireStore());
}

export function writeMany(entries: [string, unknown][]): Promise<void> {
  return setMany(entries, requireStore());
}

export function removeKey(key: string): Promise<void> {
  return del(key, requireStore());
}

export function removeKeys(keyList: string[]): Promise<void> {
  return delMany(keyList, requireStore());
}

/** Deletes every key and re-initializes meta, in one transaction. */
export async function clearStore(): Promise<void> {
  await requireStore()("readwrite", (s) => {
    s.clear();
    s.put(newMeta(), offlineKeys.meta);
    return promisifyRequest(s.transaction);
  });
}

/** Test-only: forget the memoized handle so the next open hits the current `indexedDB`. */
export function __resetOfflineStoreForTests(): void {
  storeHandle = null;
  openPromise = null;
}
