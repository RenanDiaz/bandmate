import { beforeEach, describe, expect, it } from "vitest";
import {
  IDLE_SHOW_CLOCK,
  SHOW_CLOCK_MAX_AGE_MS,
  clearAllShowClocks,
  formatShowClock,
  pauseShowClock,
  readShowClock,
  showClockElapsedMs,
  showClockKey,
  startShowClock,
  writeShowClock,
} from "../showClock";

beforeEach(() => localStorage.clear());

const T0 = Date.parse("2026-10-09T21:00:00Z");

describe("show clock state", () => {
  it("counts from the start, freezes when stopped and resumes from there", () => {
    const running = startShowClock(IDLE_SHOW_CLOCK, T0);
    expect(showClockElapsedMs(running, T0 + 65_000)).toBe(65_000);

    const paused = pauseShowClock(running, T0 + 65_000);
    expect(paused).toEqual({ status: "paused", elapsedMs: 65_000, pausedAt: T0 + 65_000 });
    expect(showClockElapsedMs(paused, T0 + 999_000)).toBe(65_000);

    const resumed = startShowClock(paused, T0 + 100_000);
    expect(showClockElapsedMs(resumed, T0 + 110_000)).toBe(75_000);
  });

  it("start on a running clock and pause on a stopped one change nothing", () => {
    const running = startShowClock(IDLE_SHOW_CLOCK, T0);
    expect(startShowClock(running, T0 + 5_000)).toBe(running);
    expect(pauseShowClock(IDLE_SHOW_CLOCK, T0)).toBe(IDLE_SHOW_CLOCK);
    expect(showClockElapsedMs(IDLE_SHOW_CLOCK, T0)).toBe(0);
  });

  it("formats m:ss under an hour and h:mm:ss from there", () => {
    expect(formatShowClock(0)).toBe("0:00");
    expect(formatShowClock(59_999)).toBe("0:59");
    expect(formatShowClock(754_000)).toBe("12:34");
    expect(formatShowClock(3_600_000)).toBe("1:00:00");
    expect(formatShowClock(5_025_000)).toBe("1:23:45");
    expect(formatShowClock(-5)).toBe("0:00");
  });
});

describe("show clock storage", () => {
  it("round-trips per user and setlist; idle removes the key", () => {
    const running = startShowClock(IDLE_SHOW_CLOCK, T0);
    writeShowClock("u1", "s1", running);
    expect(readShowClock("u1", "s1", T0 + 1_000)).toEqual(running);
    expect(readShowClock("u2", "s1", T0 + 1_000)).toEqual(IDLE_SHOW_CLOCK);
    expect(readShowClock("u1", "s2", T0 + 1_000)).toEqual(IDLE_SHOW_CLOCK);

    writeShowClock("u1", "s1", IDLE_SHOW_CLOCK);
    expect(localStorage.getItem(showClockKey("u1", "s1"))).toBeNull();
  });

  it("a clock older than 12 h is discarded and removed (next week's show starts at zero)", () => {
    writeShowClock("u1", "s1", startShowClock(IDLE_SHOW_CLOCK, T0));
    expect(readShowClock("u1", "s1", T0 + SHOW_CLOCK_MAX_AGE_MS).status).toBe("running");
    expect(readShowClock("u1", "s1", T0 + SHOW_CLOCK_MAX_AGE_MS + 1)).toEqual(IDLE_SHOW_CLOCK);
    expect(localStorage.getItem(showClockKey("u1", "s1"))).toBeNull();

    // A stopped clock ages from when it was stopped.
    writeShowClock("u1", "s1", pauseShowClock(startShowClock(IDLE_SHOW_CLOCK, T0), T0 + 3_600_000));
    expect(readShowClock("u1", "s1", T0 + 3_600_000 + SHOW_CLOCK_MAX_AGE_MS).status).toBe("paused");
  });

  it("unparsable or malformed values read as idle and are removed", () => {
    localStorage.setItem(showClockKey("u1", "s1"), "{not json");
    expect(readShowClock("u1", "s1")).toEqual(IDLE_SHOW_CLOCK);
    expect(localStorage.getItem(showClockKey("u1", "s1"))).toBeNull();

    localStorage.setItem(showClockKey("u1", "s1"), JSON.stringify({ status: "paused", elapsedMs: -1, pausedAt: T0 }));
    expect(readShowClock("u1", "s1", T0)).toEqual(IDLE_SHOW_CLOCK);
  });

  it("wipeAll's clearAllShowClocks removes them and nothing else", () => {
    writeShowClock("u1", "s1", startShowClock(IDLE_SHOW_CLOCK, T0));
    writeShowClock("u2", "s2", startShowClock(IDLE_SHOW_CLOCK, T0));
    localStorage.setItem("bandmate_perform_font_size", "120");
    clearAllShowClocks();
    expect(localStorage.getItem(showClockKey("u1", "s1"))).toBeNull();
    expect(localStorage.getItem(showClockKey("u2", "s2"))).toBeNull();
    expect(localStorage.getItem("bandmate_perform_font_size")).toBe("120");
  });
});
