import { useEffect, useState } from "react";
import { theme } from "../theme";

/**
 * What the current input and width allow (setlist builder, spec §2). Width
 * decides the layout (`wide` = the `lg` breakpoint); input decides the
 * affordances. Detected with media queries, never the user agent: an iPad
 * with a trackpad gets pointer affordances, and a touch laptop gets touch
 * affordances as soon as it is touched (the last pointer type wins).
 */
export interface InputCapabilities {
  hover: boolean;
  finePointer: boolean;
  wide: boolean;
}

const POINTER_QUERY = "(hover: hover) and (pointer: fine)";
const WIDE_QUERY = `(min-width: ${theme.breakpoints.lg})`;

/** Without matchMedia (tests, old browsers): a wide pointer device, today's behaviour. */
const FALLBACK: InputCapabilities = { hover: true, finePointer: true, wide: true };

function matches(query: string, fallback: boolean): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return fallback;
  return window.matchMedia(query).matches;
}

/** matchMedia("(hover: hover) and (pointer: fine)") + the lg breakpoint; live. */
export function useInputCapabilities(): InputCapabilities {
  const [pointerMedia, setPointerMedia] = useState(() => matches(POINTER_QUERY, FALLBACK.hover));
  const [wide, setWide] = useState(() => matches(WIDE_QUERY, FALLBACK.wide));
  // null until the first pointerdown; then the type of the last one.
  const [lastPointer, setLastPointer] = useState<"touch" | "fine" | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const pointerList = window.matchMedia(POINTER_QUERY);
    const wideList = window.matchMedia(WIDE_QUERY);
    const onPointerMedia = () => setPointerMedia(pointerList.matches);
    const onWide = () => setWide(wideList.matches);
    onPointerMedia();
    onWide();
    pointerList.addEventListener?.("change", onPointerMedia);
    wideList.addEventListener?.("change", onWide);
    return () => {
      pointerList.removeEventListener?.("change", onPointerMedia);
      wideList.removeEventListener?.("change", onWide);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch" || event.pointerType === "pen") setLastPointer("touch");
      else if (event.pointerType === "mouse") setLastPointer("fine");
    };
    window.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
    return () => window.removeEventListener("pointerdown", onPointerDown, { capture: true });
  }, []);

  const pointer = lastPointer === null ? pointerMedia : lastPointer === "fine";
  return { hover: pointer, finePointer: pointer, wide };
}
