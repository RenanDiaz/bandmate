import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useBandContext } from "../context/useBandContext";
import { useToast } from "../context/useToast";
import type { Setlist, SetlistItem } from "../services/setlistsService";
import type { Song } from "../services/songsService";
import type { SheetMusic } from "../services/songSheetMusicService";
import {
  networkPerformanceDataSource,
  PerformanceDataError,
  type PerformanceLoadError,
  type PerformanceRows,
  type PerformanceSession,
} from "./performanceDataSource";

export interface PerformanceData {
  status: "loading" | "ready" | "error";
  error: PerformanceLoadError | null;
  setlist: Setlist | null;
  /** Sorted by position. Referentially stable while the setlist row is unchanged. */
  items: SetlistItem[];
  /** Referenced songs only. */
  songsById: Record<string, Song>;
  /** All referenced songs, prefetched at load. */
  sheetMusicBySongId: Record<string, SheetMusic[]>;
  preferredSheetMusicIds: Record<string, string>;
  preferredInstrument: string | null;
  /**
   * Resolves a PDF to something SheetMusicViewer can open (a signed URL online).
   * Starting a new resolution cancels the previous one, which then rejects with
   * an AbortError, so a slow stale result never replaces the current PDF.
   */
  resolvePdfUrl: (sm: SheetMusic) => Promise<string>;
  /**
   * Remembers the choice as this user's default for the song. Network source:
   * a failed server write toasts `sheetMusic.preferenceError`, as before this
   * hook existed. The snapshot source (PR 2.4) never toasts.
   */
  selectSheetMusic: (sm: SheetMusic) => void;
  /** Reorder save. Rejects on server failure so the view keeps its error toast. */
  saveOrder: (items: SetlistItem[]) => Promise<void>;
  /** SheetMusicUpload's onUpdate: re-reads the sheet music rows. */
  onSheetMusicUploaded: () => void;
  /**
   * If the sheet music fetch failed, retries it (at most one in flight, no
   * toast). A no-op once it has succeeded. The view calls it on song change
   * and when entering the sheet music view.
   */
  retryStaleSheetMusic: () => void;
  source: "network" | "snapshot";
  /** PR 2.4. Always empty for the network source. */
  unavailableSheetMusicIds: ReadonlySet<string>;
  /**
   * Computed from the band role. Not enforced by the view yet (it had no guest
   * gating before this hook); PR 2.4 gates on them.
   */
  capabilities: { canReorder: boolean; canUpload: boolean; canSync: boolean; canEditNotes: boolean };
}

interface State {
  status: PerformanceData["status"];
  error: PerformanceLoadError | null;
  rows: PerformanceRows | null;
}

const LOADING: State = { status: "loading", error: null, rows: null };
const EMPTY_ITEMS: SetlistItem[] = [];
const EMPTY_SONGS: Record<string, Song> = {};
const EMPTY_SHEET_MUSIC: Record<string, SheetMusic[]> = {};
const EMPTY_PREFERENCES: Record<string, string> = {};
const NO_UNAVAILABLE: ReadonlySet<string> = new Set();

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function abortError(): Error {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

export function useSetlistPerformanceData(setlistId: string | undefined): PerformanceData {
  const { t } = useTranslation();
  const toast = useToast();
  const { selectedBand } = useBandContext();

  // PR 2.4 chooses between network and snapshot here.
  const source = networkPerformanceDataSource;

  const [state, setState] = useState<State>(LOADING);
  const sessionRef = useRef<PerformanceSession | null>(null);
  const retryingSessionRef = useRef<PerformanceSession | null>(null);
  const pdfAbortRef = useRef<AbortController | null>(null);
  const pdfReleaseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!setlistId) return;

    const session = source.open(setlistId);
    sessionRef.current = session;
    const controller = new AbortController();
    setState(LOADING);

    const unsubscribe = session.subscribe((rows) => {
      setState((prev) => (prev.status === "ready" ? { ...prev, rows } : prev));
    });

    session
      .load(controller.signal)
      .then((rows) => {
        if (controller.signal.aborted) return;
        setState({ status: "ready", error: null, rows });
      })
      .catch((error) => {
        if (controller.signal.aborted || isAbortError(error)) return;
        console.error("Failed to load setlist:", error);
        const code = error instanceof PerformanceDataError ? error.code : "network";
        setState({ status: "error", error: code, rows: null });
      });

    return () => {
      controller.abort();
      unsubscribe();
      session.close();
      if (sessionRef.current === session) sessionRef.current = null;
      pdfAbortRef.current?.abort();
      pdfAbortRef.current = null;
      pdfReleaseRef.current?.();
      pdfReleaseRef.current = null;
    };
  }, [setlistId, source]);

  const rows = state.rows;
  const setlist = rows?.setlist ?? null;

  const items = useMemo(
    () => (setlist ? [...(setlist.songs || [])].sort((a, b) => a.position - b.position) : EMPTY_ITEMS),
    [setlist]
  );

  const resolvePdfUrl = useCallback(async (sm: SheetMusic): Promise<string> => {
    pdfAbortRef.current?.abort();
    const controller = new AbortController();
    pdfAbortRef.current = controller;

    const session = sessionRef.current;
    if (!session) throw abortError();

    const resolved = await session.resolvePdfUrl(sm, controller.signal);
    if (controller.signal.aborted) {
      resolved.release?.();
      throw abortError();
    }
    pdfReleaseRef.current?.();
    pdfReleaseRef.current = resolved.release ?? null;
    return resolved.url;
  }, []);

  const selectSheetMusic = useCallback(
    (sm: SheetMusic) => {
      const session = sessionRef.current;
      if (!session) return;
      session.savePreference(sm).catch((err) => {
        console.error("Failed to save sheet music preference:", err);
        toast.error(t("sheetMusic.preferenceError"));
      });
    },
    [toast, t]
  );

  const saveOrder = useCallback(async (nextItems: SetlistItem[]) => {
    const session = sessionRef.current;
    if (!session) throw new Error("Performance data not loaded");
    await session.saveOrder(nextItems);
  }, []);

  const onSheetMusicUploaded = useCallback(() => {
    sessionRef.current?.refresh().catch((err) => {
      console.error("Failed to load sheet music list:", err);
    });
  }, []);

  const retryStaleSheetMusic = useCallback(() => {
    const session = sessionRef.current;
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
  const capabilities = useMemo(() => {
    const canEdit = role !== "guest";
    return { canReorder: canEdit, canUpload: canEdit, canEditNotes: canEdit, canSync: true };
  }, [role]);

  return {
    status: state.status,
    error: state.error,
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
    source: source.kind,
    unavailableSheetMusicIds: NO_UNAVAILABLE,
    capabilities,
  };
}
