import type { Setlist } from "../services/setlistsService";
import type { Show } from "../services/showsService";
import type { Song } from "../services/songsService";

/**
 * Play-history signals for the setlist builder's song picker
 * (docs/specs/setlist-builder.md §6.1). Pure: computed on the client from
 * the band's songs, setlists and shows, no reports-service call.
 *
 * "Played" means a completed show linked to a setlist that contains the
 * song; "in a setlist" (non-draft setlists only) is the weaker signal.
 */

export interface SongSignals {
  songId: string;
  /** Completed shows whose linked setlist contains the song. */
  timesPlayed: number;
  /** Non-draft setlists containing the song. */
  timesInSetlists: number;
  /** event_date of the latest completed show, YYYY-MM-DD. */
  lastPlayedAt?: string;
  lastPlayedShow?: { id: string; name: string; venue?: string };
  /** updated_at of the latest non-draft setlist containing the song. */
  lastInSetlistAt?: string;
}

export interface SongSignalsInput {
  songs: Pick<Song, "id">[];
  /** May include drafts: a show linked to a draft still counts as played. */
  setlists: Pick<Setlist, "id" | "songs" | "is_draft" | "updated_at">[];
  shows: Pick<Show, "id" | "name" | "venue" | "setlist_id" | "event_date" | "status">[];
}

function songIdsOf(setlist: Pick<Setlist, "songs">): Set<string> {
  const ids = new Set<string>();
  for (const item of setlist.songs ?? []) {
    if (item.type === "song") ids.add(item.song_id);
  }
  return ids;
}

/** One entry per song in `songs`, in the same order. Pure. */
export function computeSongSignals(input: SongSignalsInput): ReadonlyMap<string, SongSignals> {
  const signals = new Map<string, SongSignals>();
  for (const song of input.songs) {
    signals.set(song.id, { songId: song.id, timesPlayed: 0, timesInSetlists: 0 });
  }

  const songsBySetlist = new Map<string, Set<string>>();
  for (const setlist of input.setlists) {
    const ids = songIdsOf(setlist);
    songsBySetlist.set(setlist.id, ids);
    if (setlist.is_draft) continue;
    for (const songId of ids) {
      const entry = signals.get(songId);
      if (!entry) continue;
      entry.timesInSetlists += 1;
      if (!entry.lastInSetlistAt || setlist.updated_at > entry.lastInSetlistAt) {
        entry.lastInSetlistAt = setlist.updated_at;
      }
    }
  }

  for (const show of input.shows) {
    if (show.status !== "completed" || !show.setlist_id) continue;
    const ids = songsBySetlist.get(show.setlist_id);
    if (!ids) continue;
    for (const songId of ids) {
      const entry = signals.get(songId);
      if (!entry) continue;
      entry.timesPlayed += 1;
      if (!entry.lastPlayedAt || show.event_date > entry.lastPlayedAt) {
        entry.lastPlayedAt = show.event_date;
        entry.lastPlayedShow = {
          id: show.id,
          name: show.name,
          ...(show.venue?.trim() ? { venue: show.venue.trim() } : {}),
        };
      }
    }
  }

  return signals;
}

export type PlayedStatus = "never" | "stale" | "played";

export const PLAYED_STATUSES: readonly PlayedStatus[] = ["never", "stale", "played"];

/** `today` (YYYY-MM-DD) minus `months`, the day clamped to the target month's length. */
function monthsBefore(today: string, months: number): string {
  const [year, month, day] = today.split("-").map(Number);
  const totalMonths = year * 12 + (month - 1) - months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
  const targetDay = Math.min(day, daysInMonth);
  return `${String(targetYear).padStart(4, "0")}-${String(targetMonth).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
}

/** `stale`: played, but `lastPlayedAt` older than `staleAfterMonths` (default 6) at `today`. */
export function playedStatus(signals: SongSignals, today: string, staleAfterMonths = 6): PlayedStatus {
  if (signals.timesPlayed === 0 || !signals.lastPlayedAt) return "never";
  return signals.lastPlayedAt < monthsBefore(today, staleAfterMonths) ? "stale" : "played";
}
