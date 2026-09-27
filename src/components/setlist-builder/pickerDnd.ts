import { closestCenter, pointerWithin, type CollisionDetection } from "@dnd-kit/core";

/**
 * Drag a picker row into the setlist (spec §2, wide + pointer). Picker rows
 * are draggables with a prefixed id; the setlist list is a droppable, and
 * its sortable rows are the insertion targets.
 */

export const PICKER_DRAG_PREFIX = "picker:";
export const SETLIST_DROP_ID = "setlist-drop-zone";

export const pickerDragId = (songId: string) => `${PICKER_DRAG_PREFIX}${songId}`;

export function songIdFromPickerDrag(id: string | number): string | null {
  const value = String(id);
  return value.startsWith(PICKER_DRAG_PREFIX) ? value.slice(PICKER_DRAG_PREFIX.length) : null;
}

/**
 * Picker drags hit only what the pointer is over (dropping back on the
 * library does nothing), preferring a row over the list itself; reorders
 * keep closestCenter among the rows.
 */
export const editorCollisionDetection: CollisionDetection = (args) => {
  if (songIdFromPickerDrag(args.active.id) !== null) {
    const hits = pointerWithin(args);
    const rows = hits.filter((hit) => hit.id !== SETLIST_DROP_ID);
    return rows.length > 0 ? rows : hits;
  }
  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter((container) => container.id !== SETLIST_DROP_ID),
  });
};
