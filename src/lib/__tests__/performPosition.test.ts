import { beforeEach, describe, expect, it } from "vitest";
import {
  PERFORM_POSITION_MAX_AGE_MS,
  clearAllPerformPositions,
  performPositionKey,
  PREFERRED_CONTENT_VIEW_KEY,
  readPerformPosition,
  readPreferredContentView,
  writePerformPosition,
  writePreferredContentView,
} from "../performPosition";

const position = { currentIndex: 4, contentView: "sheetMusic" as const, selectedSheetMusicId: "sm-2" };

beforeEach(() => localStorage.clear());

describe("perform position (A2, §9.4)", () => {
  it("round-trips per user and setlist", () => {
    const now = new Date("2026-09-25T20:00:00Z");
    writePerformPosition("u1", "s1", position, now);
    expect(readPerformPosition("u1", "s1", now.getTime())).toEqual({ ...position, savedAt: now.toISOString() });
    expect(readPerformPosition("u2", "s1", now.getTime())).toBeNull();
    expect(readPerformPosition("u1", "s2", now.getTime())).toBeNull();
  });

  it("a position older than 12 h is discarded and removed (B7: next week's show starts at the top)", () => {
    const saved = new Date("2026-09-25T08:00:00Z");
    writePerformPosition("u1", "s1", position, saved);
    const justInside = saved.getTime() + PERFORM_POSITION_MAX_AGE_MS;
    expect(readPerformPosition("u1", "s1", justInside)).not.toBeNull();
    expect(readPerformPosition("u1", "s1", justInside + 1)).toBeNull();
    expect(localStorage.getItem(performPositionKey("u1", "s1"))).toBeNull();
  });

  it("unparsable or malformed values read as null and are removed", () => {
    localStorage.setItem(performPositionKey("u1", "s1"), "{not json");
    expect(readPerformPosition("u1", "s1")).toBeNull();
    expect(localStorage.getItem(performPositionKey("u1", "s1"))).toBeNull();
    localStorage.setItem(
      performPositionKey("u1", "s1"),
      JSON.stringify({ currentIndex: -1, contentView: "chords", selectedSheetMusicId: null, savedAt: new Date().toISOString() })
    );
    expect(readPerformPosition("u1", "s1")).toBeNull();
  });

  it("wipeAll's clearAllPerformPositions removes them", () => {
    writePerformPosition("u1", "s1", position);
    clearAllPerformPositions();
    expect(readPerformPosition("u1", "s1")).toBeNull();
  });

  it("a song target's pseudo id (song:<id>) round-trips and is cleared too", () => {
    const now = new Date("2026-09-25T20:00:00Z");
    writePerformPosition("u1", "song:x", position, now);
    expect(readPerformPosition("u1", "song:x", now.getTime())).toEqual({ ...position, savedAt: now.toISOString() });
    expect(readPerformPosition("u1", "x", now.getTime())).toBeNull();
    clearAllPerformPositions();
    expect(readPerformPosition("u1", "song:x", now.getTime())).toBeNull();
  });
});

describe("preferred content view", () => {
  it("defaults to lyrics, then returns the last pick", () => {
    expect(readPreferredContentView()).toBe("lyrics");
    writePreferredContentView("sheetMusic");
    expect(readPreferredContentView()).toBe("sheetMusic");
  });

  it("ignores an unknown stored value", () => {
    localStorage.setItem(PREFERRED_CONTENT_VIEW_KEY, "tabs");
    expect(readPreferredContentView()).toBe("lyrics");
  });

  it("survives clearing the positions", () => {
    writePreferredContentView("chords");
    clearAllPerformPositions();
    expect(readPreferredContentView()).toBe("chords");
  });
});
