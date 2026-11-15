import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { resolveSheetSwipe } from "../utils/sheetSwipe";

interface Drag {
  pointerId: number;
  startY: number;
  lastY: number;
  lastT: number;
  velocity: number;
}

/**
 * Swipe on a bottom sheet's handle (see `resolveSheetSwipe`). Spread
 * `handleProps` on the header that carries the handle, not on the list:
 * the list keeps its scroll and its drag-to-reorder. `active` says whether
 * the element is a sheet right now (a phone-width media query); otherwise
 * the header ignores the pointer.
 */
export function useSheetSwipe({ onClose, active }: { onClose: () => void; active: () => boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [offset, setOffset] = useState(0);
  const dragRef = useRef<Drag | null>(null);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!active() || (event.pointerType === "mouse" && event.button !== 0)) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        lastY: event.clientY,
        lastT: event.timeStamp,
        velocity: 0,
      };
    },
    [active]
  );

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dt = event.timeStamp - drag.lastT;
    if (dt > 0) drag.velocity = (event.clientY - drag.lastY) / dt;
    drag.lastY = event.clientY;
    drag.lastT = event.timeStamp;
    // The sheet follows the finger down only; up is a gesture, not a resize.
    setOffset(Math.max(0, event.clientY - drag.startY));
  }, []);

  const finish = useCallback(
    (event: ReactPointerEvent<HTMLElement>, cancelled: boolean) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      setOffset(0);
      if (cancelled) return;
      const result = resolveSheetSwipe({ dy: event.clientY - drag.startY, velocity: drag.velocity, expanded });
      if (result === "close") onClose();
      else if (result === "collapse") setExpanded(false);
      else if (result === "expand") setExpanded(true);
    },
    [expanded, onClose]
  );

  return {
    expanded,
    /** Collapse to the normal detent (call when the sheet closes). */
    reset: useCallback(() => setExpanded(false), []),
    /** px the sheet is pulled down; 0 when not dragging. */
    offset,
    dragging: offset > 0,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (event: ReactPointerEvent<HTMLElement>) => finish(event, false),
      onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => finish(event, true),
    },
  };
}
