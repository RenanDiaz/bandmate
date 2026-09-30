import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { OfflineDownloadState } from "../context/offlineDownloadController";
import { getOfflineDownloadController } from "../context/offlineDownloadController";
import type { OfflineEvent, OfflineSnapshot, OfflineSnapshotMeta } from "../services/offlineSetlistService";
import {
  dismissSchemaWipeNotice,
  getSchemaWipeNotice,
  getSnapshot,
  getSnapshotMeta,
  getStorageUsage,
  listInterruptedDownloads,
  listOfflineBands,
  listSnapshots,
  subscribe,
} from "../services/offlineSetlistService";
import type { Band } from "../services/bandsService";

/**
 * React access to offline downloads (PR 2.3): the controller's state
 * (running download, results) and the service's reads, re-read whenever the
 * service says something changed. Components use these instead of calling the
 * service on their own.
 */

export function useOfflineDownloadState(): OfflineDownloadState {
  const controller = getOfflineDownloadController();
  return useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
}

function affects(event: OfflineEvent, setlistId?: string): boolean {
  if (event.type === "snapshot-changed") return !setlistId || event.setlistId === setlistId;
  return event.type === "store-wiped" || event.type === "visibility-changed";
}

/** The current user's snapshot meta for a setlist; `undefined` while loading, `null` when there is none. */
export function useOfflineSnapshotMeta(setlistId: string | undefined): OfflineSnapshotMeta | null | undefined {
  const [meta, setMeta] = useState<OfflineSnapshotMeta | null | undefined>(undefined);
  useEffect(() => {
    if (!setlistId) {
      setMeta(null);
      return;
    }
    let cancelled = false;
    const read = () =>
      void getSnapshotMeta(setlistId).then((m) => {
        if (!cancelled) setMeta(m);
      });
    read();
    const unsubscribe = subscribe((event) => {
      if (affects(event, setlistId)) read();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [setlistId]);
  return meta;
}

/** Every snapshot meta of the current user, keyed by setlist id (for list badges). */
export function useOfflineSnapshotMetas(): Record<string, OfflineSnapshotMeta> {
  const [metas, setMetas] = useState<Record<string, OfflineSnapshotMeta>>({});
  useEffect(() => {
    let cancelled = false;
    const read = () =>
      void listSnapshots().then((list) => {
        if (!cancelled) setMetas(Object.fromEntries(list.map((m) => [m.setlistId, m])));
      });
    read();
    const unsubscribe = subscribe((event) => {
      if (affects(event)) read();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);
  return metas;
}

/** The interrupted download of a setlist (journal left by a killed or suspended page), or null. */
export function useInterruptedDownload(setlistId: string | undefined): { startedAt: string } | null {
  const { revision, active } = useOfflineDownloadState();
  const activeId = active?.setlistId;
  const [entry, setEntry] = useState<{ startedAt: string } | null>(null);
  useEffect(() => {
    if (!setlistId || activeId === setlistId) {
      setEntry(null);
      return;
    }
    let cancelled = false;
    const read = () =>
      void listInterruptedDownloads().then((list) => {
        if (cancelled) return;
        const found = list.find((j) => j.setlistId === setlistId);
        setEntry(found ? { startedAt: found.startedAt } : null);
      });
    read();
    const unsubscribe = subscribe((event) => {
      if (affects(event, setlistId)) read();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [setlistId, revision, activeId]);
  return entry;
}

/**
 * Re-read `read()` now, on every offline event `affects`, and whenever `deps`
 * change. `undefined` until the first read resolves. Shared by the offline
 * screens' hooks below (PR 2.5).
 */
function useOfflineRead<T>(read: (() => Promise<T>) | null, relevant: (event: OfflineEvent) => boolean): {
  value: T | undefined;
  reload: () => void;
} {
  const [value, setValue] = useState<T | undefined>(undefined);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setValue(undefined);
    if (!read) return;
    let cancelled = false;
    const run = () =>
      void read().then((v) => {
        if (!cancelled) setValue(v);
      });
    run();
    const unsubscribe = subscribe((event) => {
      if (relevant(event)) run();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // `read`/`relevant` are memoized by the callers; `tick` forces a re-read.
  }, [read, relevant, tick]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { value, reload };
}

const anyChange = (event: OfflineEvent) => affects(event);

/** Every snapshot meta of the current user, newest first; `undefined` while loading. */
export function useOfflineSnapshotList(enabled = true): OfflineSnapshotMeta[] | undefined {
  const read = useCallback(() => listSnapshots(), []);
  return useOfflineRead(enabled ? read : null, anyChange).value;
}

/** The current user's snapshot of a setlist; `undefined` while loading, `null` when there is none. */
export function useOfflineSnapshot(setlistId: string | undefined): OfflineSnapshot | null | undefined {
  const read = useCallback(() => (setlistId ? getSnapshot(setlistId) : Promise.resolve(null)), [setlistId]);
  const relevant = useCallback((event: OfflineEvent) => affects(event, setlistId), [setlistId]);
  return useOfflineRead(read, relevant).value;
}

/** Every interrupted download (journal) of the current user except the running one. */
export function useInterruptedDownloads(): Array<{ setlistId: string; setlistName: string; startedAt: string }> {
  const { revision, active } = useOfflineDownloadState();
  const activeId = active?.setlistId;
  // Re-created when the controller's state moves, so a finished or resumed job re-reads.
  const read = useCallback(
    () => listInterruptedDownloads(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revision, activeId]
  );
  return useOfflineRead(read, anyChange).value ?? [];
}

export type SchemaWipeEntry = { setlistId: string; setlistName: string; bandId: number | null };

/** The A4 schema-wipe notice entries of the current user (empty when none) and its dismiss actions. */
export function useSchemaWipeNotice(): {
  entries: SchemaWipeEntry[];
  dismiss: (setlistId?: string) => Promise<void>;
} {
  const read = useCallback(() => getSchemaWipeNotice(), []);
  const { value, reload } = useOfflineRead(read, anyChange);
  const dismiss = useCallback(
    async (setlistId?: string) => {
      await dismissSchemaWipeNotice(setlistId);
      reload();
    },
    [reload]
  );
  return { entries: value ?? [], dismiss };
}

/** Bands named by the current user's snapshots (for the management list, PR 3.4); `undefined` while loading. */
export function useOfflineBands(): Band[] | undefined {
  const read = useCallback(() => listOfflineBands(), []);
  return useOfflineRead(read, anyChange).value;
}

export type OfflineStorageUsage = Awaited<ReturnType<typeof getStorageUsage>>;

/** Device usage, quota, persistence and the offline copies' bytes (§6.6); `reload` after requestPersistence. */
export function useOfflineStorageUsage(): { usage: OfflineStorageUsage | undefined; reload: () => void } {
  const read = useCallback(() => getStorageUsage(), []);
  const { value, reload } = useOfflineRead(read, anyChange);
  return { usage: value, reload };
}
