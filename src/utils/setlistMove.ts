import type { SetlistItem } from "../services/setlistsService";

/** The row menu's moves (setlist builder, spec §3.5): the non-drag way to reorder. */
export type MoveTarget = "up" | "down" | "top" | "bottom";

export const MOVE_TARGETS: readonly MoveTarget[] = ["up", "down", "top", "bottom"];

/** Whether `target` would move the item at `index` in a list of `count`. */
export function canMove(index: number, count: number, target: MoveTarget): boolean {
  if (index < 0 || index >= count) return false;
  return target === "up" || target === "top" ? index > 0 : index < count - 1;
}

/**
 * Move the item at `index` one step or to an end; positions are reindexed.
 * Returns the same array when nothing moves. Pure.
 */
export function moveItem<T extends SetlistItem>(items: T[], index: number, target: MoveTarget): T[] {
  if (!canMove(index, items.length, target)) return items;
  const to =
    target === "up" ? index - 1 : target === "down" ? index + 1 : target === "top" ? 0 : items.length - 1;
  const next = [...items];
  const [moved] = next.splice(index, 1);
  next.splice(to, 0, moved);
  return next.map((item, position) => ({ ...item, position }));
}
