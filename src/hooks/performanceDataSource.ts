import { getSetlist, updateSetlist, isSongItem } from "../services/setlistsService";
import type { Setlist, SetlistItem } from "../services/setlistsService";
import { getSongsByIds } from "../services/songsService";
import type { Song } from "../services/songsService";
import { getSheetMusicForSongs } from "../services/songSheetMusicService";
import type { SheetMusic } from "../services/songSheetMusicService";
import { getSheetMusicUrl } from "../services/sheetMusicStorageService";
import {
  getMySheetMusicPreferences,
  setMySheetMusicPreference,
  getPreferredInstrument,
  setPreferredInstrument,
} from "../services/sheetMusicPreferencesService";
import type { PerformanceTarget } from "./performanceTarget";

/** Everything performance mode reads, as one immutable value. */
export interface PerformanceRows {
  setlist: Setlist;
  /** Songs the setlist references (not the band library). */
  songsById: Record<string, Song>;
  /** Every referenced song, with an empty array when it has no PDFs; sorted by position. */
  sheetMusicBySongId: Record<string, SheetMusic[]>;
  /** This user's preferred PDF per song (song_id -> sheet_music_id). */
  preferredSheetMusicIds: Record<string, string>;
  /** Device-local instrument shortcut for this band. */
  preferredInstrument: string | null;
  /**
   * Snapshot source only: sheet music ids the rows reference but the device
   * does not have (any `missingFiles` reason, incl. "not-downloaded", plus
   * blobs found absent or unreadable in this session). Absent for the network source.
   */
  unavailableSheetMusicIds?: ReadonlySet<string>;
}

export type PerformanceLoadError = "not-found" | "not-authenticated" | "network";

export class PerformanceDataError extends Error {
  readonly code: PerformanceLoadError;

  readonly cause: unknown;

  constructor(code: PerformanceLoadError, cause?: unknown) {
    super(`Performance data unavailable: ${code}`);
    this.name = "PerformanceDataError";
    this.code = code;
    this.cause = cause;
  }
}

/**
 * A PDF the viewer can open. `release` frees what the source allocated for it
 * (the snapshot source revokes a blob URL); the hook calls it when the PDF is
 * replaced or on unmount. Signed URLs need no release.
 */
export interface ResolvedPdf {
  url: string;
  release?: () => void;
}

export interface PerformanceDataSource {
  readonly kind: "network" | "snapshot" | "song";
  /**
   * One session per mounted target. The network and snapshot sources accept
   * only setlist targets, the song source only song targets; the controller
   * never hands them the other kind, and the session rejects with "not-found"
   * if it happens anyway.
   */
  open(target: PerformanceTarget): PerformanceSession;
}

/**
 * A session owns the current rows for one setlist. After `load()` resolves, any
 * change (a background refresh, `refresh()`, or a write that succeeded) is
 * delivered to `subscribe` listeners as a full `PerformanceRows` replacement.
 *
 * Emit rules (the view relies on them):
 * - Unchanged parts keep their reference identity. A sheet-music refresh reuses
 *   the same `setlist` object, so the hook's sorted `items` stay `===` and the
 *   view does not reseed its local (possibly reordered) item list.
 * - Writes emit only after the server write succeeded; a failed write leaves
 *   the rows untouched and rejects to the caller. The one exception is the
 *   PDF preference, which is optimistic (see `savePreference`).
 */
export interface PerformanceSession {
  /** Initial rows. Rejects with PerformanceDataError. */
  load(signal: AbortSignal): Promise<PerformanceRows>;
  /** Row replacements after load. Returns the unsubscribe function. */
  subscribe(listener: (rows: PerformanceRows) => void): () => void;
  /**
   * Re-reads what may have changed and emits if it did. Network: the sheet
   * music rows of the referenced songs (what SheetMusicUpload can change).
   * Resolves without emitting when the session is closed; rejects on failure.
   */
  refresh(): Promise<void>;
  /** True when the last sheet music fetch (load or refresh) failed; a successful `refresh()` clears it. */
  isSheetMusicStale(): boolean;
  /** Rejects with an AbortError-named error when `signal` aborts first. */
  resolvePdfUrl(sm: SheetMusic, signal: AbortSignal): Promise<ResolvedPdf>;
  /**
   * Makes `sm` this user's preferred PDF for its song (and its instrument the
   * device shortcut). Optimistic: patches the rows and emits synchronously,
   * then persists; rejects if persisting fails, leaving the choice applied.
   * No server call when the preference is already `sm`.
   */
  savePreference(sm: SheetMusic): Promise<void>;
  /** Saves a new item order; on success patches the rows and emits. Rejects on failure. */
  saveOrder(items: SetlistItem[]): Promise<void>;
  close(): void;
}

/**
 * A session whose `load()` rejects with `PerformanceDataError("not-found")`:
 * what a source returns for a target of the wrong kind.
 */
export function wrongTargetSession(): PerformanceSession {
  const reject = () => Promise.reject(new PerformanceDataError("not-found"));
  return {
    load: reject,
    subscribe: () => () => undefined,
    refresh: async () => undefined,
    isSheetMusicStale: () => false,
    resolvePdfUrl: reject,
    savePreference: reject,
    saveOrder: reject,
    close: () => undefined,
  };
}

/**
 * The snapshot source found no snapshot of this setlist for the current user.
 * The hook then falls back to the network source when online (§8.2).
 */
export class NoSnapshotError extends Error {
  constructor() {
    super("No offline copy of this setlist");
    this.name = "NoSnapshotError";
  }
}

/** resolvePdfUrl on the snapshot source: the file is not on the device, or its blob is empty/unreadable (§9.3). */
export class PdfUnavailableError extends Error {
  readonly sheetMusicId: string;
  constructor(sheetMusicId: string) {
    super("This PDF is not on this device");
    this.name = "PdfUnavailableError";
    this.sheetMusicId = sheetMusicId;
  }
}

export function toLoadError(error: unknown): PerformanceDataError {
  if (error instanceof PerformanceDataError) return error;
  if (error instanceof Error && error.message === "User not authenticated") {
    return new PerformanceDataError("not-authenticated", error);
  }
  if ((error as { code?: string } | null)?.code === "PGRST116") {
    return new PerformanceDataError("not-found", error);
  }
  return new PerformanceDataError("network", error);
}

export function abortError(): Error {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

/** A signed Storage URL for `sm` (network and song sources). */
export async function resolveSignedPdfUrl(sm: SheetMusic, signal: AbortSignal): Promise<ResolvedPdf> {
  if (signal.aborted) throw abortError();
  const url = await getSheetMusicUrl(sm.file_url);
  if (signal.aborted) throw abortError();
  return { url };
}

/**
 * `PerformanceSession.savePreference` against the server (network and song
 * sources). Optimistic: the choice shows at once and stays applied even if the
 * server write fails.
 */
export async function saveServerPreference(
  rows: PerformanceRows,
  sm: SheetMusic,
  emit: (rows: PerformanceRows) => void
): Promise<void> {
  if (sm.instrument) setPreferredInstrument(rows.setlist.band_id, sm.instrument);
  const preferredInstrument = sm.instrument || rows.preferredInstrument;
  const preferenceChanged = rows.preferredSheetMusicIds[sm.song_id] !== sm.id;
  if (!preferenceChanged && preferredInstrument === rows.preferredInstrument) return;
  emit({
    ...rows,
    preferredSheetMusicIds: preferenceChanged
      ? { ...rows.preferredSheetMusicIds, [sm.song_id]: sm.id }
      : rows.preferredSheetMusicIds,
    preferredInstrument,
  });
  if (!preferenceChanged) return;
  await setMySheetMusicPreference(sm.song_id, sm.id);
}

function referencedSongIds(setlist: Setlist): string[] {
  return [...new Set((setlist.songs || []).filter(isSongItem).map((item) => item.song_id))];
}

function openNetworkSession(setlistId: string): PerformanceSession {
  let rows: PerformanceRows | null = null;
  let sheetMusicStale = false;
  let closed = false;
  const listeners = new Set<(rows: PerformanceRows) => void>();

  const emit = (next: PerformanceRows) => {
    rows = next;
    if (closed) return;
    for (const listener of listeners) listener(next);
  };

  return {
    async load(signal) {
      try {
        const setlist = await getSetlist(setlistId);
        if (signal.aborted) throw abortError();

        const songIds = referencedSongIds(setlist);
        const songs = await getSongsByIds(songIds);
        if (signal.aborted) throw abortError();
        const songsById: Record<string, Song> = {};
        for (const song of songs) songsById[song.id] = song;

        const preferredInstrument = getPreferredInstrument(setlist.band_id);

        // This user's preferred PDF per song; a failure here must not block
        // performance mode, we just fall back to the band order.
        let preferredSheetMusicIds: Record<string, string> = {};
        try {
          preferredSheetMusicIds = await getMySheetMusicPreferences(songIds);
        } catch (error) {
          console.error("Failed to load sheet music preferences:", error);
        }
        if (signal.aborted) throw abortError();

        // Sheet music never blocks performance mode either. On failure the
        // session is marked stale and the hook retries through refresh().
        let sheetMusicBySongId: Record<string, SheetMusic[]> = {};
        try {
          sheetMusicBySongId = await getSheetMusicForSongs(songIds);
          sheetMusicStale = false;
        } catch (error) {
          console.error("Failed to load sheet music list:", error);
          sheetMusicStale = true;
        }
        if (signal.aborted) throw abortError();

        rows = { setlist, songsById, sheetMusicBySongId, preferredSheetMusicIds, preferredInstrument };
        return rows;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw error;
        throw toLoadError(error);
      }
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async refresh() {
      if (!rows || closed) return;
      let sheetMusicBySongId: Record<string, SheetMusic[]>;
      try {
        sheetMusicBySongId = await getSheetMusicForSongs(referencedSongIds(rows.setlist));
      } catch (error) {
        sheetMusicStale = true;
        throw error;
      }
      sheetMusicStale = false;
      if (!rows || closed) return;
      emit({ ...rows, sheetMusicBySongId });
    },

    isSheetMusicStale() {
      return sheetMusicStale;
    },

    resolvePdfUrl: resolveSignedPdfUrl,

    async savePreference(sm) {
      if (rows) await saveServerPreference(rows, sm, emit);
    },

    async saveOrder(items) {
      if (!rows) return;
      await updateSetlist(rows.setlist.id, { songs: items });
      if (!rows) return;
      // Keep the items as the view sent them (client ids included), exactly as
      // the view did before this moved here.
      emit({ ...rows, setlist: { ...rows.setlist, songs: items } });
    },

    close() {
      closed = true;
      listeners.clear();
    },
  };
}

/** Today's behaviour: everything from Supabase, signed URLs for PDFs. */
export const networkPerformanceDataSource: PerformanceDataSource = {
  kind: "network",
  open: (target) => (target.kind === "setlist" ? openNetworkSession(target.setlistId) : wrongTargetSession()),
};
