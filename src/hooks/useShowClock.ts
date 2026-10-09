import { useCallback, useEffect, useRef, useState } from "react";
import {
  IDLE_SHOW_CLOCK,
  pauseShowClock,
  readShowClock,
  showClockElapsedMs,
  startShowClock,
  writeShowClock,
} from "../lib/showClock";
import type { ShowClock } from "../lib/showClock";

/**
 * The show clock of one setlist for one user (docs/specs/show-clock.md),
 * persisted in localStorage. Without a user or key it stays idle in memory.
 */
export function useShowClock(userId: string | null, targetKey: string) {
  const [clock, setClockState] = useState<ShowClock>(() =>
    userId && targetKey ? readShowClock(userId, targetKey) : IDLE_SHOW_CLOCK
  );
  const clockRef = useRef(clock);
  const [now, setNow] = useState(() => Date.now());

  // Another user or setlist: its own clock.
  useEffect(() => {
    const next = userId && targetKey ? readShowClock(userId, targetKey) : IDLE_SHOW_CLOCK;
    clockRef.current = next;
    setClockState(next);
    setNow(Date.now());
  }, [userId, targetKey]);

  const setClock = useCallback(
    (next: ShowClock) => {
      if (next === clockRef.current) return;
      clockRef.current = next;
      setClockState(next);
      setNow(Date.now());
      if (userId && targetKey) writeShowClock(userId, targetKey, next);
    },
    [userId, targetKey]
  );

  // Re-render while running; the time itself comes from timestamps.
  useEffect(() => {
    if (clock.status !== "running") return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [clock.status]);

  const start = useCallback(() => setClock(startShowClock(clockRef.current)), [setClock]);
  const pause = useCallback(() => setClock(pauseShowClock(clockRef.current)), [setClock]);
  const reset = useCallback(() => setClock(IDLE_SHOW_CLOCK), [setClock]);
  /** The automatic start (first song's backing track): only from idle, never resumes a paused clock. */
  const startIfIdle = useCallback(() => {
    if (clockRef.current.status === "idle") setClock(startShowClock(clockRef.current));
  }, [setClock]);

  return {
    clock,
    elapsedMs: showClockElapsedMs(clock, now),
    start,
    pause,
    reset,
    startIfIdle,
  };
}
