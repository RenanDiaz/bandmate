import { beforeEach, describe, expect, it } from "vitest";
import {
  PERFORM_POSITION_MAX_AGE_MS,
  clearAllPerformPositions,
  performPositionKey,
  readPerformPosition,
  writePerformPosition,
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
});
