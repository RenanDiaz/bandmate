import type { SetlistItem, SetlistSongItem } from "../services/setlistsService";
import type { Song } from "../services/songsService";

/**
 * Length of a setlist against its target (docs/specs/setlist-builder.md §4.1,
 * §6.3). Pure: types only from the services, so it never loads Supabase.
 */

export interface PlanProgress {
  songCount: number;
  musicSeconds: number;
  /** Music + breaks. */
  totalSeconds: number;
  targetSeconds?: number;
  /** totalSeconds / targetSeconds; undefined without a target. */
  ratio?: number;
  /** Only when over target. */
  overBySeconds?: number;
}

// Legacy rows have no `type`; same rule as `isSongItem` in setlistsService.
function isSong(item: SetlistItem): item is SetlistSongItem {
  return item.type === "song" || (!item.type && "song_id" in item);
}

/** A usable target in minutes, or null (empty, zero, negative, not a number). */
export function normalizeTargetMinutes(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const minutes = Math.round(value);
  return minutes > 0 ? minutes : null;
}

export function planProgress(
  items: SetlistItem[],
  songsById: ReadonlyMap<string, Song>,
  targetMinutes?: number | null,
): PlanProgress {
  let songCount = 0;
  let musicSeconds = 0;
  let breakSeconds = 0;
  for (const item of items) {
    if (isSong(item)) {
      songCount += 1;
      musicSeconds += songsById.get(item.song_id)?.duration || 0;
    } else if (item.type === "break") {
      breakSeconds += (item.duration || 0) * 60;
    }
  }
  const totalSeconds = musicSeconds + breakSeconds;
  const progress: PlanProgress = { songCount, musicSeconds, totalSeconds };

  const target = normalizeTargetMinutes(targetMinutes);
  if (target !== null) {
    progress.targetSeconds = target * 60;
    progress.ratio = totalSeconds / progress.targetSeconds;
    if (totalSeconds > progress.targetSeconds) progress.overBySeconds = totalSeconds - progress.targetSeconds;
  }
  return progress;
}

/**
 * Seconds (songs + breaks) from each section item up to the next one; key =
 * the section's item id. Same rule as the `technical` text export: songs
 * missing from `songsById` add nothing, items before the first section
 * belong to none.
 */
export function sectionSubtotals(
  items: SetlistItem[],
  songsById: ReadonlyMap<string, Song>,
): ReadonlyMap<string, number> {
  const totals = new Map<string, number>();
  let current: string | null = null;
  for (const item of items) {
    if (item.type === "section") {
      current = item.id ?? null;
      if (current !== null) totals.set(current, 0);
    } else if (current !== null) {
      const seconds = isSong(item)
        ? songsById.get(item.song_id)?.duration || 0
        : item.type === "break"
          ? (item.duration || 0) * 60
          : 0;
      totals.set(current, (totals.get(current) ?? 0) + seconds);
    }
  }
  return totals;
}
