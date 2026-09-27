import type { Setlist } from "../services/setlistsService";
import { getSongsByIds } from "../services/songsService";
import type { Song } from "../services/songsService";
import { getSheetMusicForSongs } from "../services/songSheetMusicService";
import type { SheetMusic } from "../services/songSheetMusicService";
import { getMySheetMusicPreferences, getPreferredInstrument } from "../services/sheetMusicPreferencesService";
import { shareRecord } from "../utils/deepEqual";
import {
  PerformanceDataError,
  abortError,
  resolveSignedPdfUrl,
  saveServerPreference,
  toLoadError,
  wrongTargetSession,
} from "./performanceDataSource";
import type { PerformanceDataSource, PerformanceRows, PerformanceSession } from "./performanceDataSource";
import { performanceTargetKey } from "./performanceTarget";

/**
 * Performance mode for one song from the library (docs/specs/song-performance.md
 * §3.2). Online only: the same reads as the network source for a one-item
 * setlist, which is built in memory (`id: "song:<songId>"`) and never written.
 * A song has no order to save and no setlist row for sync or snapshots.
 */

export interface SongSourceDeps {
  /** The selected band's id, read at load: a song of another band is "not-found". */
  getBandId: () => number | undefined;
}

/** The one-item setlist the view renders for `song`. Its id never reaches a setlist service. */
export function syntheticSetlist(song: Song): Setlist {
  return {
    id: performanceTargetKey({ kind: "song", songId: song.id }),
    band_id: song.band_id,
    user_id: song.user_id,
    name: song.title,
    description: undefined,
    is_draft: false,
    songs: [{ type: "song", song_id: song.id, position: 0 }],
    youtube_playlist_url: undefined,
    created_at: song.created_at,
    updated_at: song.created_at,
  };
}

function openSongSession(songId: string, deps: SongSourceDeps): PerformanceSession {
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
        const songs = await getSongsByIds([songId]);
        if (signal.aborted) throw abortError();
        const song = songs.length === 1 ? songs[0] : undefined;
        if (!song || song.id !== songId || song.band_id !== deps.getBandId()) {
          throw new PerformanceDataError("not-found");
        }

        const preferredInstrument = getPreferredInstrument(song.band_id);

        // As the network source: preferences never block performance mode.
        let preferredSheetMusicIds: Record<string, string> = {};
        try {
          preferredSheetMusicIds = await getMySheetMusicPreferences([songId]);
        } catch (error) {
          console.error("Failed to load sheet music preferences:", error);
        }
        if (signal.aborted) throw abortError();

        // Nor does sheet music: on failure the session is stale and the hook retries.
        let sheetMusicBySongId: Record<string, SheetMusic[]> = {};
        try {
          sheetMusicBySongId = await getSheetMusicForSongs([songId]);
          sheetMusicStale = false;
        } catch (error) {
          console.error("Failed to load sheet music list:", error);
          sheetMusicStale = true;
        }
        if (signal.aborted) throw abortError();

        rows = {
          setlist: syntheticSetlist(song),
          songsById: { [song.id]: song },
          sheetMusicBySongId,
          preferredSheetMusicIds,
          preferredInstrument,
        };
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
        sheetMusicBySongId = await getSheetMusicForSongs([songId]);
      } catch (error) {
        sheetMusicStale = true;
        throw error;
      }
      sheetMusicStale = false;
      if (!rows || closed) return;
      const shared = shareRecord(rows.sheetMusicBySongId, sheetMusicBySongId);
      if (shared === rows.sheetMusicBySongId) return;
      // The synthetic setlist keeps its identity: the view's items stay `===`.
      emit({ ...rows, sheetMusicBySongId: shared });
    },

    isSheetMusicStale() {
      return sheetMusicStale;
    },

    resolvePdfUrl: resolveSignedPdfUrl,

    async savePreference(sm) {
      if (rows) await saveServerPreference(rows, sm, emit);
    },

    async saveOrder() {
      // canReorder is false for a song target; this is never called.
      throw new Error("song target has no order");
    },

    close() {
      closed = true;
      listeners.clear();
    },
  };
}

export function createSongPerformanceDataSource(deps: SongSourceDeps): PerformanceDataSource {
  return {
    kind: "song",
    open: (target) => (target.kind === "song" ? openSongSession(target.songId, deps) : wrongTargetSession()),
  };
}
