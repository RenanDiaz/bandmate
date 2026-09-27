import { updateSetlist } from "../services/setlistsService";
import type { SheetMusic } from "../services/songSheetMusicService";
import {
  getPreferredInstrument,
  setMySheetMusicPreference,
  setPreferredInstrument,
} from "../services/sheetMusicPreferencesService";
import {
  flushLocalPreferences,
  getFile,
  getSnapshot,
  getSnapshotMeta,
  markSnapshotFileMissing,
  patchSnapshotPreference,
  patchSnapshotSetlist,
  recordLocalPreference,
  refreshSnapshotRows,
  subscribe as subscribeOffline,
} from "../services/offlineSetlistService";
import type { OfflineSnapshot, OfflineSnapshotMeta } from "../services/offlineSetlistService";
import { isNetworkError } from "../lib/networkErrors";
import { deepEqual, shareRecord } from "../utils/deepEqual";
import { NoSnapshotError, PdfUnavailableError, wrongTargetSession } from "./performanceDataSource";
import type { PerformanceDataSource, PerformanceRows, PerformanceSession } from "./performanceDataSource";

/**
 * Performance mode from the offline copy (spec §8.2, PR 2.4). Renders from the
 * snapshot at once, online too; online it then flushes offline PDF choices and
 * refreshes the rows in the background (A3), and every change to the snapshot
 * (`snapshot-changed`) is re-read and emitted with reference identity kept for
 * the parts that did not change. PDFs come from the store as blob URLs, one at
 * a time, never prefetched (§9.5).
 */

export interface SnapshotSourceDeps {
  /** The app's online status (BandContext `isOnline`), read at call time. */
  isOnline: () => boolean;
  /** BandContext `reportNetworkFailure`: a background refresh failed on weak signal. */
  reportNetworkFailure: () => void;
  /** BandContext `reportNetworkSuccess`: the server answered (resets the backoff). */
  reportNetworkSuccess?: () => void;
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
}

function abortError(): Error {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

/**
 * §9.3: the key can exist with a blob that reads as empty (partial eviction)
 * or throws on read. Reads the first bytes only; never the whole file.
 */
async function isReadable(blob: Blob): Promise<boolean> {
  if (blob.size === 0) return false;
  try {
    return (await blob.slice(0, 4).arrayBuffer()).byteLength > 0;
  } catch {
    return false;
  }
}

function rowsFromSnapshot(snapshot: OfflineSnapshot, meta: OfflineSnapshotMeta, broken: ReadonlySet<string>): PerformanceRows {
  const unavailable = new Set<string>(broken);
  for (const missing of meta.missingFiles) unavailable.add(missing.sheetMusicId);
  return {
    setlist: snapshot.setlist,
    songsById: snapshot.songsById,
    sheetMusicBySongId: snapshot.sheetMusicBySongId,
    // A choice made offline and not flushed yet wins over the server's (§5.6).
    preferredSheetMusicIds: { ...snapshot.preferredSheetMusicIds, ...(snapshot.localPreferenceOverrides ?? {}) },
    preferredInstrument: getPreferredInstrument(snapshot.band.id) ?? snapshot.preferredInstrument,
    unavailableSheetMusicIds: unavailable,
  };
}

function sameSet(a: ReadonlySet<string> | undefined, b: ReadonlySet<string> | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

/**
 * `next`, reusing `prev`'s objects for every part that is structurally equal
 * (emit rule 1): an unchanged setlist stays `===`, so the hook's sorted items
 * do too and the view does not reseed. Returns `prev` itself when nothing changed.
 */
export function shareRows(prev: PerformanceRows | null, next: PerformanceRows): PerformanceRows {
  if (!prev) return next;
  const shared: PerformanceRows = {
    setlist: deepEqual(prev.setlist, next.setlist) ? prev.setlist : next.setlist,
    songsById: shareRecord(prev.songsById, next.songsById),
    sheetMusicBySongId: shareRecord(prev.sheetMusicBySongId, next.sheetMusicBySongId),
    preferredSheetMusicIds: deepEqual(prev.preferredSheetMusicIds, next.preferredSheetMusicIds)
      ? prev.preferredSheetMusicIds
      : next.preferredSheetMusicIds,
    preferredInstrument: next.preferredInstrument,
    unavailableSheetMusicIds: sameSet(prev.unavailableSheetMusicIds, next.unavailableSheetMusicIds)
      ? prev.unavailableSheetMusicIds
      : next.unavailableSheetMusicIds,
  };
  const unchanged = (Object.keys(shared) as Array<keyof PerformanceRows>).every((key) => shared[key] === prev[key]);
  return unchanged ? prev : shared;
}

function openSnapshotSession(setlistId: string, deps: SnapshotSourceDeps): PerformanceSession {
  const createObjectURL = deps.createObjectURL ?? ((blob: Blob) => URL.createObjectURL(blob));
  const revokeObjectURL = deps.revokeObjectURL ?? ((url: string) => URL.revokeObjectURL(url));

  let rows: PerformanceRows | null = null;
  let closed = false;
  const listeners = new Set<(rows: PerformanceRows) => void>();
  /** Files that failed to load in this session, unavailable even before the meta records them. */
  const broken = new Set<string>();
  let unsubscribeOffline: (() => void) | null = null;
  let rereading: Promise<void> | null = null;
  let rereadAgain = false;

  const emit = (next: PerformanceRows) => {
    if (next === rows) return;
    rows = next;
    if (closed) return;
    for (const listener of listeners) listener(next);
  };

  // One re-read at a time; events that arrive meanwhile run one more.
  const reread = (): Promise<void> => {
    if (closed || !rows) return Promise.resolve();
    if (rereading) {
      rereadAgain = true;
      return rereading;
    }
    rereading = (async () => {
      do {
        rereadAgain = false;
        const [snapshot, meta] = await Promise.all([getSnapshot(setlistId), getSnapshotMeta(setlistId)]);
        // Gone (a wipe, another user): keep rendering what is on screen.
        if (closed || !snapshot || !meta) return;
        emit(shareRows(rows, rowsFromSnapshot(snapshot, meta, broken)));
      } while (rereadAgain && !closed);
    })().finally(() => {
      rereading = null;
    });
    return rereading;
  };

  /**
   * §9.3, only for a blob that is absent or zero-length (never for a pdf.js
   * failure, which the view retries): unavailable for this session at once.
   * Online it is also recorded in missingFiles and the `file:` key deleted, so
   * Retry refetches it; offline nothing is written, the key stays.
   */
  const markPdfUnreadable = (sm: SheetMusic) => {
    if (broken.has(sm.id)) return;
    broken.add(sm.id);
    if (rows) {
      const unavailable = new Set(rows.unavailableSheetMusicIds ?? []);
      unavailable.add(sm.id);
      emit({ ...rows, unavailableSheetMusicIds: unavailable });
    }
    if (deps.isOnline()) void markSnapshotFileMissing(setlistId, sm.file_url, { deleteFile: true });
  };

  const session: PerformanceSession = {
    async load(signal) {
      const [snapshot, meta] = await Promise.all([getSnapshot(setlistId), getSnapshotMeta(setlistId)]);
      if (signal.aborted) throw abortError();
      if (!snapshot || !meta) throw new NoSnapshotError();
      rows = rowsFromSnapshot(snapshot, meta, broken);
      unsubscribeOffline = subscribeOffline((event) => {
        if (event.type === "snapshot-changed" && event.setlistId === setlistId) void reread();
      });
      // A3: render now, refresh the rows in the background. Silent on failure.
      if (deps.isOnline()) void session.refresh().catch(() => undefined);
      return rows;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    /**
     * §8.2 online: flush offline PDF choices first (so the refresh reads them
     * back), then refresh the rows; a commit emits through `snapshot-changed`.
     * Never downloads a PDF. Rejects when the refresh failed (weak signal).
     */
    async refresh() {
      if (!rows || closed || !deps.isOnline()) return;
      await flushLocalPreferences(setlistId);
      if (closed) return;
      let status: Awaited<ReturnType<typeof refreshSnapshotRows>>["status"];
      try {
        ({ status } = await refreshSnapshotRows(setlistId));
      } catch (error) {
        // not-authenticated ("offline-cached"): nothing to refresh with yet.
        console.info("Offline copy not refreshed:", error);
        return;
      }
      if (status === "failed") {
        deps.reportNetworkFailure();
        throw new Error("Offline copy refresh failed");
      }
      if (status !== "skipped") deps.reportNetworkSuccess?.();
      await reread();
    },

    isSheetMusicStale() {
      return false; // the snapshot has every referenced song's rows
    },

    async resolvePdfUrl(sm: SheetMusic, signal: AbortSignal) {
      if (signal.aborted) throw abortError();
      if (broken.has(sm.id)) throw new PdfUnavailableError(sm.id);
      const blob = await getFile(sm.file_url);
      if (signal.aborted) throw abortError();
      if (!blob || !(await isReadable(blob))) {
        if (signal.aborted) throw abortError();
        // §9.3: absent although the meta says stored, or emptied by eviction.
        markPdfUnreadable(sm);
        throw new PdfUnavailableError(sm.id);
      }
      if (signal.aborted) throw abortError();
      const url = createObjectURL(blob);
      let released = false;
      return {
        url,
        release: () => {
          if (released) return;
          released = true;
          revokeObjectURL(url);
        },
      };
    },

    /**
     * Optimistic, like the network source. Online: the server write, then the
     * snapshot patch (A3); if the server write fails, or offline, the choice
     * is kept as a local override for the next flush (§5.6). Never rejects.
     */
    async savePreference(sm) {
      if (!rows) return;
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
      if (deps.isOnline()) {
        try {
          await setMySheetMusicPreference(sm.song_id, sm.id);
          deps.reportNetworkSuccess?.();
          await patchSnapshotPreference(setlistId, sm.song_id, sm.id);
          return;
        } catch (error) {
          console.warn("PDF choice not saved to the server; kept on this device:", error);
          if (isNetworkError(error)) deps.reportNetworkFailure();
        }
      }
      await recordLocalPreference(setlistId, sm.song_id, sm.id);
    },

    /** Online only (offline the view disables reorder): server write, emit, then the snapshot patch (B12). */
    async saveOrder(items) {
      if (!rows) return;
      if (!deps.isOnline()) throw new Error("Reordering needs a connection");
      const saved = await updateSetlist(rows.setlist.id, { songs: items });
      if (!rows) return;
      // Keep the items as the view sent them (client ids included).
      const setlist = { ...rows.setlist, ...saved, songs: items };
      emit(shareRows(rows, { ...rows, setlist }));
      await patchSnapshotSetlist(setlistId, setlist);
    },

    close() {
      closed = true;
      listeners.clear();
      unsubscribeOffline?.();
      unsubscribeOffline = null;
    },
  };
  return session;
}

export function createSnapshotPerformanceDataSource(deps: SnapshotSourceDeps): PerformanceDataSource {
  return {
    kind: "snapshot",
    open: (target) => (target.kind === "setlist" ? openSnapshotSession(target.setlistId, deps) : wrongTargetSession()),
  };
}
