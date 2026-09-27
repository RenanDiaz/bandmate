import { KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

/**
 * Sensors for every sortable setlist list (setlist builder, spec §3.5): the
 * editor, the detail view's reorder mode and performance mode's reorder.
 *
 * - Mouse: starts after 8 px, so a click on the handle stays a click.
 * - Touch: a 250 ms long-press on the handle (5 px tolerance); moving sooner
 *   cancels it, so scrolling never starts a drag. Handles set
 *   `touch-action: none`.
 * - Keyboard: Space/Enter on the handle, arrows to move.
 */
export function useSortableSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
}
