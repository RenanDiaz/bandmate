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
  /**
   * Changes on every clear (wipeAll, schema wipe). Guarded writes compare it
   * inside their own transaction, so a download that started before a wipe
   * can't recreate records after it, in this tab or another (PR 2.2b). Absent
   * on metas written before 2.2b; read as null. Optional and additive, so no
   * schema bump.
   */
  epoch?: string;
}

export interface OfflineSchemaWipeLostEntry {
  userId: string;
  setlistId: string;
  setlistName: string;
  bandId: number | null;
}

/** Written by a schema-mismatch wipe (§3.5 #2); entries are removed as they are dismissed. */
export interface OfflineSchemaWipeNotice {
  wipedAt: string;
  /** null when meta was missing/unreadable. */
  fromVersion: number | null;
  toVersion: typeof OFFLINE_SCHEMA_VERSION;
  /** Only this user's entries are ever shown to them (§3.5 #1). */
  lost: OfflineSchemaWipeLostEntry[];
  // No per-user dismissal list: by A1 the store holds one user's data at a
  // time, so dismissing removes that user's entries and the key goes when
  // `lost` is empty.
}

export type OfflineStoreOpenResult =
  | { status: "ready"; meta: OfflineStoreMeta; schemaWipe: OfflineSchemaWipeNotice | null }
  | { status: "unavailable"; error: unknown };

let storeHandle: UseStore | null = null;
/** Clears started in this tab; lets the service notice a local wipe without a read. */
let wipeCount = 0;
let openPromise: Promise<OfflineStoreOpenResult> | null = null;

function newEpoch(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function newMeta(): OfflineStoreMeta {
  return { schemaVersion: OFFLINE_SCHEMA_VERSION, persisted: null, lastGcAt: null, epoch: newEpoch() };
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
        }
      : null;

  wipeCount++;
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

/** Deletes every key and re-initializes meta (with a new epoch), in one transaction. */
export async function clearStore(): Promise<void> {
  wipeCount++;
  await requireStore()("readwrite", (s) => {
    s.clear();
    s.put(newMeta(), offlineKeys.meta);
    return promisifyRequest(s.transaction);
  });
}

// ---------------------------------------------------------------------------
// Transactions (PR 2.2b): several reads and writes in one IDB transaction, and
// writes guarded by the store epoch.
// ---------------------------------------------------------------------------

/** Number of clears started in this tab since load. */
export function localWipeCount(): number {
  return wipeCount;
}

/** The current store epoch (see OfflineStoreMeta.epoch); null on a pre-2.2b meta. */
export async function readEpoch(): Promise<string | null> {
  const meta = await readKey<OfflineStoreMeta>(offlineKeys.meta);
  return typeof meta?.epoch === "string" ? meta.epoch : null;
}

/** A guarded transaction found another epoch: the store was wiped since the caller read it. Nothing was written. */
export class StoreEpochChangedError extends Error {
  constructor() {
    super("The offline store was wiped");
    this.name = "StoreEpochChangedError";
  }
}

/**
 * A write transaction that aborted. `requestError` is the failing put's error,
 * `transactionError` the transaction's: Safari reports a full disk as an
 * AbortError on the request with the QuotaExceededError only on the
 * transaction, so callers check both (isQuotaExceeded).
 */
export class StoreWriteError extends Error {
  readonly requestError: unknown;
  readonly transactionError: unknown;
  constructor(requestError: unknown, transactionError: unknown) {
    super(
      errorName(transactionError) ?? errorName(requestError) ?? "Offline store write failed"
    );
    this.name = "StoreWriteError";
    this.requestError = requestError;
    this.transactionError = transactionError;
  }
}

function errorName(error: unknown): string | undefined {
  const name = (error as { name?: unknown } | null)?.name;
  return typeof name === "string" ? name : undefined;
}

function isQuotaLike(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { name, code } = error as { name?: unknown; code?: unknown };
  // 22: legacy QUOTA_EXCEEDED_ERR; Firefox's own name for the same condition.
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" || code === 22;
}

/** §4.5: a DOMException QuotaExceededError, or Safari's aborted transaction carrying one. */
export function isQuotaExceeded(error: unknown): boolean {
  if (error instanceof StoreWriteError) {
    return isQuotaLike(error.requestError) || isQuotaLike(error.transactionError);
  }
  return isQuotaLike(error);
}

/** The operations available inside transact(). Reads resolve while the transaction is alive; await nothing else inside it. */
export interface StoreTx {
  get<T>(key: string): Promise<T | undefined>;
  keys(): Promise<string[]>;
  has(key: string): Promise<boolean>;
  put(key: string, value: unknown): void;
  delete(key: string): void;
}

type WriteFault = (key: string) => unknown;
let writeFault: WriteFault | null = null;

/**
 * Test-only: `fault(key)` runs for every put inside transact(); a non-undefined
 * return aborts the transaction and the call rejects as if IndexedDB had
 * failed with it (a StoreWriteError is used as is, anything else becomes its
 * requestError). fake-indexeddb has no quota, so this is how quota is tested.
 */
export function __setWriteFaultForTests(fault: WriteFault | null): void {
  writeFault = fault;
}

function requestPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Runs `fn` in one IndexedDB transaction and resolves with its result once the
 * transaction has committed. With `epoch` set (a value from readEpoch()), the
 * transaction first reads `meta` and rejects with StoreEpochChangedError,
 * writing nothing, when the epoch differs: IDB serializes readwrite
 * transactions on the store across tabs, so a wipe either committed before
 * (epoch differs, nothing written) or runs after (and clears what was written).
 */
export function transact<T>(
  mode: IDBTransactionMode,
  fn: (tx: StoreTx) => Promise<T>,
  opts: { epoch?: string | null } = {}
): Promise<T> {
  return requireStore()(mode, (s) => {
    const transaction = s.transaction;
    let putError: unknown = undefined;
    let injected: unknown = undefined;
    let epochChanged = false;

    const tx: StoreTx = {
      get: <V>(key: string) => requestPromise(s.get(key)) as Promise<V | undefined>,
      keys: async () => (await requestPromise(s.getAllKeys())).filter((k): k is string => typeof k === "string"),
      has: async (key) => (await requestPromise(s.count(key))) > 0,
      put: (key, value) => {
        if (injected !== undefined) return;
        const fault = writeFault?.(key);
        if (fault !== undefined) {
          injected = fault;
          transaction.abort();
          return;
        }
        const request = s.put(value, key);
        request.onerror = () => {
          putError ??= request.error;
        };
      },
      delete: (key) => {
        if (injected === undefined) s.delete(key);
      },
    };

    const done = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => {
        if (epochChanged) reject(new StoreEpochChangedError());
        else if (injected instanceof StoreWriteError) reject(injected);
        else if (injected !== undefined) reject(new StoreWriteError(injected, null));
        else reject(new StoreWriteError(putError ?? null, transaction.error));
      };
    });

    const body = (async () => {
      if (opts.epoch !== undefined) {
        const meta = await tx.get<OfflineStoreMeta>(offlineKeys.meta);
        const current = typeof meta?.epoch === "string" ? meta.epoch : null;
        if (current !== opts.epoch) {
          epochChanged = true;
          transaction.abort();
          return undefined as T;
        }
      }
      return fn(tx);
    })();

    body.catch(() => {
      // fn threw: abort so nothing it queued is committed.
      try {
        transaction.abort();
      } catch {
        // already finished
      }
    });

    return Promise.all([body, done]).then(([result]) => result);
  });
}

/** Test-only: forget the memoized handle so the next open hits the current `indexedDB`. */
export function __resetOfflineStoreForTests(): void {
  storeHandle = null;
  openPromise = null;
  writeFault = null;
}
