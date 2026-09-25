// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  NETWORK_FAILURE_MAX_OFFLINE_MS,
  NETWORK_FAILURE_OFFLINE_MS,
  forcedOfflineMs,
  useOnlineStatus,
} from "../useOnlineStatus";

const SECOND = 1000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});
afterEach(() => {
  vi.useRealTimers();
});

/** Fails once, then returns how long the forced-offline window lasted (ms, to the second). */
function measureWindow(result: { current: ReturnType<typeof useOnlineStatus> }): number {
  act(() => result.current.reportNetworkFailure());
  expect(result.current.isOnline).toBe(false);
  let elapsed = 0;
  while (!result.current.isOnline) {
    act(() => vi.advanceTimersByTime(SECOND));
    elapsed += SECOND;
    if (elapsed > NETWORK_FAILURE_MAX_OFFLINE_MS * 2) throw new Error("window never ended");
  }
  return elapsed;
}

describe("forcedOfflineMs", () => {
  it("doubles from 30 s and caps at 5 min", () => {
    expect([1, 2, 3, 4, 5, 6, 20].map(forcedOfflineMs)).toEqual([
      30 * SECOND,
      60 * SECOND,
      120 * SECOND,
      240 * SECOND,
      300 * SECOND,
      300 * SECOND,
      300 * SECOND,
    ]);
  });
});

describe("useOnlineStatus backoff (§7.3)", () => {
  it("consecutive failures double the window up to the 5 min cap", () => {
    const { result } = renderHook(() => useOnlineStatus());
    const windows = [1, 2, 3, 4, 5, 6].map(() => measureWindow(result));
    expect(windows).toEqual([30, 60, 120, 240, 300, 300].map((s) => s * SECOND));
    expect(windows[5]).toBe(NETWORK_FAILURE_MAX_OFFLINE_MS);
  });

  it("failures inside a running window restart it at the same length, no escalation", () => {
    const { result } = renderHook(() => useOnlineStatus());
    act(() => result.current.reportNetworkFailure());
    act(() => vi.advanceTimersByTime(20 * SECOND));
    act(() => result.current.reportNetworkFailure()); // same outage (e.g. a second request)
    act(() => vi.advanceTimersByTime(NETWORK_FAILURE_OFFLINE_MS - 1));
    expect(result.current.isOnline).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.isOnline).toBe(true);
    // The next failure is only the second in a row: 60 s.
    expect(measureWindow(result)).toBe(60 * SECOND);
  });

  it("a successful request resets the backoff to 30 s", () => {
    const { result } = renderHook(() => useOnlineStatus());
    measureWindow(result); // 30 s
    measureWindow(result); // 60 s
    act(() => result.current.reportNetworkSuccess());
    expect(measureWindow(result)).toBe(NETWORK_FAILURE_OFFLINE_MS);
  });

  it("a success does not end a running window (a cached answer looks like one)", () => {
    const { result } = renderHook(() => useOnlineStatus());
    act(() => result.current.reportNetworkFailure());
    act(() => result.current.reportNetworkSuccess());
    expect(result.current.isOnline).toBe(false);
  });

  it("the browser's online event ends the window at once and resets the backoff", () => {
    const { result } = renderHook(() => useOnlineStatus());
    measureWindow(result); // 30 s
    act(() => result.current.reportNetworkFailure()); // 60 s window running
    expect(result.current.isOnline).toBe(false);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current.isOnline).toBe(true);
    expect(measureWindow(result)).toBe(NETWORK_FAILURE_OFFLINE_MS);
  });

  it("does nothing while the browser already says offline", () => {
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const { result } = renderHook(() => useOnlineStatus());
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    act(() => result.current.reportNetworkFailure());
    onLine.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current.isOnline).toBe(true);
  });
});
