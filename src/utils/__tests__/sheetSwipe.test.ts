import { describe, expect, it } from "vitest";
import { SHEET_SWIPE_DISTANCE, SHEET_SWIPE_VELOCITY, resolveSheetSwipe } from "../sheetSwipe";

describe("resolveSheetSwipe", () => {
  it("down from the normal detent closes, from expanded collapses", () => {
    expect(resolveSheetSwipe({ dy: SHEET_SWIPE_DISTANCE, velocity: 0.1, expanded: false })).toBe("close");
    expect(resolveSheetSwipe({ dy: SHEET_SWIPE_DISTANCE, velocity: 0.1, expanded: true })).toBe("collapse");
  });

  it("up expands, and does nothing more once expanded", () => {
    expect(resolveSheetSwipe({ dy: -SHEET_SWIPE_DISTANCE, velocity: -0.1, expanded: false })).toBe("expand");
    expect(resolveSheetSwipe({ dy: -200, velocity: -2, expanded: true })).toBe("stay");
  });

  it("a short fast flick counts, a short slow drag does not", () => {
    expect(resolveSheetSwipe({ dy: 20, velocity: SHEET_SWIPE_VELOCITY, expanded: false })).toBe("close");
    expect(resolveSheetSwipe({ dy: -20, velocity: -SHEET_SWIPE_VELOCITY, expanded: false })).toBe("expand");
    expect(resolveSheetSwipe({ dy: 30, velocity: 0.1, expanded: false })).toBe("stay");
  });

  it("a tap or a drag that ends against its own direction stays", () => {
    expect(resolveSheetSwipe({ dy: 4, velocity: 3, expanded: false })).toBe("stay");
    // Pulled down far, then flicked back up before letting go.
    expect(resolveSheetSwipe({ dy: 80, velocity: -1, expanded: false })).toBe("stay");
    expect(resolveSheetSwipe({ dy: -80, velocity: 1, expanded: false })).toBe("stay");
  });
});
