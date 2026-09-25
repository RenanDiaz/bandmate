import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useBandContext } from "../context/useBandContext";
import { useToast } from "../context/useToast";
import type { Setlist, SetlistItem } from "../services/setlistsService";
import type { Song } from "../services/songsService";
import type { SheetMusic } from "../services/songSheetMusicService";
import { isOfflineDownloadsEnabled } from "../lib/featureFlags";
import { networkPerformanceDataSource, type PerformanceLoadError } from "./performanceDataSource";
import { createSnapshotPerformanceDataSource } from "./snapshotPerformanceDataSource";
import {
  PerformanceDataController,
  performanceCapabilities,
  type PerformanceCapabilities,
  type PerformanceDataState,
} from "./performanceDataController";

export interface PerformanceData {
  status: "loading" | "ready" | "error";
  error: PerformanceLoadError | null;
  /**
   * No offline copy of this setlist and no connection (§8.2 rule 3). The view
   * shows "Not available offline" with Back: no toast, no bounce (B8).
   */
  unavailableOffline: boolean;
  setlist: Setlist | null;
  /** Sorted by position. Referentially stable while the setlist row is unchanged. */
  items: SetlistItem[];
  /** Referenced songs only. */
  songsById: Record<string, Song>;
  /** All referenced songs, prefetched at load. */
  sheetMusicBySongId: Record<string, SheetMusic[]>;
  /** Server preferences, with offline choices not flushed yet on top (snapshot source). */
  preferredSheetMusicIds: Record<string, string>;
  preferredInstrument: string | null;
  /**
   * Resolves a PDF to something SheetMusicViewer can open: a signed URL
   * online, a blob URL from the device on the snapshot source. The previous
   * PDF's resources are released first (only the current PDF holds a blob
   * URL, §9.5). Starting a new resolution cancels the previous one, which
   * then rejects with an AbortError, so a slow stale result never replaces
   * the current PDF. Snapshot source: rejects with PdfUnavailableError when
   * the file is not on the device.
   */
  resolvePdfUrl: (sm: SheetMusic) => Promise<string>;
  /**
   * Remembers the choice as this user's default for the song. Network source:
   * a failed server write toasts `sheetMusic.preferenceError`. Snapshot
   * source: never toasts (offline it is kept on the device, §5.6).
   */
  selectSheetMusic: (sm: SheetMusic) => void;
  /** Reorder save. Rejects on server failure so the view keeps its error toast. */
  saveOrder: (items: SetlistItem[]) => Promise<void>;
  /** SheetMusicUpload's onUpdate: re-reads the sheet music rows (snapshot: a row refresh, A3). */
  onSheetMusicUploaded: () => void;
  /**
   * If the sheet music fetch failed, retries it (at most one in flight, no
   * toast). A no-op once it has succeeded. The view calls it on song change
   * and when entering the sheet music view.
   */
  retryStaleSheetMusic: () => void;
  source: "network" | "snapshot";
  /** Sheet music ids listed in the snapshot but not on the device; always empty for the network source. */
  unavailableSheetMusicIds: ReadonlySet<string>;
  /** §8.3: enforced by the view (offline and guest gating). */
  capabilities: PerformanceCapabilities;
}

const LOADING: PerformanceDataState = {
  status: "loading",
  error: null,
  rows: null,
  source: "network",
  unavailableOffline: false,
};
const EMPTY_ITEMS: SetlistItem[] = [];
const EMPTY_SONGS: Record<string, Song> = {};
const EMPTY_SHEET_MUSIC: Record<string, SheetMusic[]> = {};
const EMPTY_PREFERENCES: Record<string, string> = {};
const NO_UNAVAILABLE: ReadonlySet<string> = new Set();

function abortError(): Error {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

export function useSetlistPerformanceData(setlistId: string | undefined): PerformanceData {
  const { t } = useTranslation();
  const toast = useToast();
  const { selectedBand, isOnline, reportNetworkFailure } = useBandContext();

  // Read at call time by the snapshot source and the controller.
  const isOnlineRef = useRef(isOnline);
  const reportNetworkFailureRef = useRef(reportNetworkFailure);
  useEffect(() => {
    isOnlineRef.current = isOnline;
    reportNetworkFailureRef.current = reportNetworkFailure;
  }, [isOnline, reportNetworkFailure]);

  const [state, setState] = useState<PerformanceDataState>(LOADING);
  const controllerRef = useRef<PerformanceDataController | null>(null);
  const retryingSessionRef = useRef<unknown>(null);
  const pdfAbortRef = useRef<AbortController | null>(null);
  const pdfReleaseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!setlistId) return;
    const controller = new PerformanceDataController({
      setlistId,
      // The flag gates source selection (removed in PR 2.5). Read per mount.
      useSnapshots: isOfflineDownloadsEnabled(),
      isOnline: () => isOnlineRef.current,
      network: networkPerformanceDataSource,
      snapshot: createSnapshotPerformanceDataSource({
        isOnline: () => isOnlineRef.current,
        reportNetworkFailure: () => reportNetworkFailureRef.current(),
      }),
    });
    controllerRef.current = controller;
    setState(controller.getState());
    const unsubscribe = controller.subscribe(() => setState(controller.getState()));

    return () => {
      unsubscribe();
      controller.dispose();
      if (controllerRef.current === controller) controllerRef.current = null;
      pdfAbortRef.current?.abort();
      pdfAbortRef.current = null;
      pdfReleaseRef.current?.();
      pdfReleaseRef.current = null;
    };
  }, [setlistId]);

  // Back online: the snapshot source refreshes its rows (A3).
  const wasOnlineRef = useRef(isOnline);
  useEffect(() => {
    if (isOnline && !wasOnlineRef.current) controllerRef.current?.onOnline();
    wasOnlineRef.current = isOnline;
  }, [isOnline]);

  const rows = state.rows;
  const setlist = rows?.setlist ?? null;
  const source = state.source;

  const items = useMemo(
    () => (setlist ? [...(setlist.songs || [])].sort((a, b) => a.position - b.position) : EMPTY_ITEMS),
    [setlist]
  );

  const resolvePdfUrl = useCallback(async (sm: SheetMusic): Promise<string> => {
    pdfAbortRef.current?.abort();
    const controller = new AbortController();
    pdfAbortRef.current = controller;
    // §9.5: revoke the previous blob URL before creating the next.
    pdfReleaseRef.current?.();
    pdfReleaseRef.current = null;

    const session = controllerRef.current?.getSession();
    if (!session) throw abortError();

    const resolved = await session.resolvePdfUrl(sm, controller.signal);
    if (controller.signal.aborted) {
      resolved.release?.();
      throw abortError();
    }
    // Released above, before resolving: only this PDF holds a blob URL now.
    pdfReleaseRef.current = resolved.release ?? null;
    return resolved.url;
  }, []);

  const selectSheetMusic = useCallback(
    (sm: SheetMusic) => {
      const session = controllerRef.current?.getSession();
      if (!session) return;
      const fromSnapshot = controllerRef.current?.getState().source === "snapshot";
      session.savePreference(sm).catch((err) => {
        console.error("Failed to save sheet music preference:", err);
        if (!fromSnapshot) toast.error(t("sheetMusic.preferenceError"));
      });
    },
    [toast, t]
  );

  const saveOrder = useCallback(async (nextItems: SetlistItem[]) => {
    const session = controllerRef.current?.getSession();
    if (!session) throw new Error("Performance data not loaded");
    await session.saveOrder(nextItems);
  }, []);

  const onSheetMusicUploaded = useCallback(() => {
    controllerRef.current
      ?.getSession()
      ?.refresh()
      .catch((err) => {
        console.error("Failed to load sheet music list:", err);
      });
  }, []);

  const retryStaleSheetMusic = useCallback(() => {
    const session = controllerRef.current?.getSession();
    if (!session || !session.isSheetMusicStale() || retryingSessionRef.current === session) return;
    retryingSessionRef.current = session;
    session
      .refresh()
      .catch((err) => {
        console.error("Failed to load sheet music list:", err);
      })
      .finally(() => {
        if (retryingSessionRef.current === session) retryingSessionRef.current = null;
      });
  }, []);

  const role = selectedBand?.user_role;
  const capabilities = useMemo(() => performanceCapabilities({ role, isOnline }), [role, isOnline]);

  return {
    status: state.status,
    error: state.error,
    unavailableOffline: state.unavailableOffline,
    setlist,
    items,
    songsById: rows?.songsById ?? EMPTY_SONGS,
    sheetMusicBySongId: rows?.sheetMusicBySongId ?? EMPTY_SHEET_MUSIC,
    preferredSheetMusicIds: rows?.preferredSheetMusicIds ?? EMPTY_PREFERENCES,
    preferredInstrument: rows?.preferredInstrument ?? null,
    resolvePdfUrl,
    selectSheetMusic,
    saveOrder,
    onSheetMusicUploaded,
    retryStaleSheetMusic,
    source,
    unavailableSheetMusicIds: rows?.unavailableSheetMusicIds ?? NO_UNAVAILABLE,
    capabilities,
  };
}
