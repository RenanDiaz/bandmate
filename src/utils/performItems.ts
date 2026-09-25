import { getSetlistItemKey } from "../services/setlistsService";
import type { SetlistItem } from "../services/setlistsService";

/**
 * Where performance mode should be after its items were replaced mid-show
 * (a background row refresh, a write, spec §8.2): on the same item, found by
 * identity (`getSetlistItemKey`: `song_id` for songs, `id` for special items),
 * not by index. If that item was removed, on the nearest item that remains:
 * the first following item still present (it moved up into the removed
 * slot), else the closest preceding one. Never jumps to the start for that
 * reason; 0 only when nothing is left.
 */
export function indexAfterItemsChange(prev: SetlistItem[], prevIndex: number, next: SetlistItem[]): number {
  if (next.length === 0) return 0;
  const clamped = Math.min(Math.max(prevIndex, 0), next.length - 1);
  const current = prev[prevIndex];
  if (!current) return clamped;

  const nextIndexByKey = new Map<string, number>();
  next.forEach((item, index) => {
    const key = getSetlistItemKey(item);
    if (!nextIndexByKey.has(key)) nextIndexByKey.set(key, index);
  });
  const indexOf = (item: SetlistItem) => nextIndexByKey.get(getSetlistItemKey(item));

  const same = indexOf(current);
  if (same !== undefined) return same;
  for (let i = prevIndex + 1; i < prev.length; i++) {
    const found = indexOf(prev[i]);
    if (found !== undefined) return found;
  }
  for (let i = prevIndex - 1; i >= 0; i--) {
    const found = indexOf(prev[i]);
    if (found !== undefined) return found;
  }
  return clamped;
}
