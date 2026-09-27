import type { SetlistItem, SetlistSongItem } from "../services/setlistsService";

/**
 * Insert songs into a setlist's items (setlist builder, spec §3.4): at
 * `index` (clamped; the end when omitted), in the given order, skipping songs
 * already in the setlist and duplicates. Positions are reindexed. Pure.
 */
export function insertSongs(items: SetlistItem[], songIds: string[], index?: number): SetlistItem[] {
  const present = new Set(items.filter((item) => item.type === "song").map((item) => (item as SetlistSongItem).song_id));
  const added: SetlistSongItem[] = [];
  for (const songId of songIds) {
    if (present.has(songId)) continue;
    present.add(songId);
    added.push({ type: "song", song_id: songId, position: 0, notes: "" });
  }
  if (added.length === 0) return items;

  const at = index === undefined ? items.length : Math.max(0, Math.min(index, items.length));
  return [...items.slice(0, at), ...added, ...items.slice(at)].map((item, position) => ({ ...item, position }));
}
