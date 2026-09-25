import { useEffect, useState, useSyncExternalStore } from "react";
import type { OfflineDownloadState } from "../context/offlineDownloadController";
import { getOfflineDownloadController } from "../context/offlineDownloadController";
import type { OfflineEvent, OfflineSnapshotMeta } from "../services/offlineSetlistService";
import { getSnapshotMeta, listInterruptedDownloads, listSnapshots, subscribe } from "../services/offlineSetlistService";

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
