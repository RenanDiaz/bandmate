/**
 * What a swipe on a bottom sheet's handle does when the finger lifts. Two
 * detents (normal, expanded) plus closed, like the iOS sheets: up expands,
 * down from expanded collapses, down from normal closes. A short, fast flick
 * counts as much as a long drag. Pure, unit-tested.
 */
export type SheetSwipeResult = "close" | "collapse" | "expand" | "stay";

/** Distance (px) a drag must travel to change detent. */
export const SHEET_SWIPE_DISTANCE = 60;
/** Speed (px/ms) of a flick that changes detent whatever the distance. */
export const SHEET_SWIPE_VELOCITY = 0.5;
/** Below this distance (px) a release is a tap, never a swipe. */
const MIN_FLICK_DISTANCE = 10;

export function resolveSheetSwipe({
  dy,
  velocity,
  expanded,
}: {
  /** Finger travel, positive = down. */
  dy: number;
  /** Signed speed at release, px/ms, positive = down. */
  velocity: number;
  expanded: boolean;
}): SheetSwipeResult {
  if (Math.abs(dy) < MIN_FLICK_DISTANCE) return "stay";
  // A fast flick against the drag at release cancels it (pulled down, then
  // thrown back up before letting go).
  const down =
    dy > 0 && (dy >= SHEET_SWIPE_DISTANCE || velocity >= SHEET_SWIPE_VELOCITY) && velocity > -SHEET_SWIPE_VELOCITY;
  const up =
    dy < 0 && (dy <= -SHEET_SWIPE_DISTANCE || velocity <= -SHEET_SWIPE_VELOCITY) && velocity < SHEET_SWIPE_VELOCITY;
  if (down) return expanded ? "collapse" : "close";
  if (up) return expanded ? "stay" : "expand";
  return "stay";
}
