// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useShowClock } from "../useShowClock";
import { readShowClock } from "../../lib/showClock";

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse("2026-10-09T21:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("useShowClock (show-clock spec)", () => {
  it("ticks while running and persists across a remount (relaunch mid-show)", () => {
    const { result, unmount } = renderHook(() => useShowClock("u1", "s1"));
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(90_000));
    expect(result.current.elapsedMs).toBe(90_000);
    unmount();

    vi.advanceTimersByTime(30_000);
    const again = renderHook(() => useShowClock("u1", "s1"));
    expect(again.result.current.clock.status).toBe("running");
    expect(again.result.current.elapsedMs).toBe(120_000);
  });

  it("startIfIdle starts only from idle: a stopped clock stays stopped until Resume or Reset", () => {
    const { result } = renderHook(() => useShowClock("u1", "s1"));
    act(() => result.current.startIfIdle());
    act(() => vi.advanceTimersByTime(60_000));
    act(() => result.current.pause());
    act(() => result.current.startIfIdle());
    expect(result.current.clock.status).toBe("paused");

    act(() => result.current.reset());
    expect(readShowClock("u1", "s1").status).toBe("idle");
    act(() => result.current.startIfIdle());
    expect(result.current.clock.status).toBe("running");
    expect(result.current.elapsedMs).toBe(0);
  });

  it("without a user it works in memory and writes nothing", () => {
    const { result } = renderHook(() => useShowClock(null, "s1"));
    act(() => result.current.start());
    expect(result.current.clock.status).toBe("running");
    expect(localStorage.length).toBe(0);
  });
});
