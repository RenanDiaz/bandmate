/**
 * Show clock in performance mode (docs/specs/show-clock.md): how long the
 * show has been running. Pure state + localStorage per user and setlist, so a
 * relaunch mid-show (iOS kills the PWA) keeps counting from the real start.
 * Time is always derived from timestamps, never from a ticking counter, so a
 * backgrounded or sleeping tab doesn't lose time. Like the perform position,
 * a clock older than 12 hours is discarded on read and `wipeAll()` removes
 * every key (they identify setlists).
 */

export type ShowClock =
  | { status: "idle" }
  | { status: "running"; /** epoch ms the elapsed time counts from */ startedAt: number }
  | { status: "paused"; elapsedMs: number; /** epoch ms */ pausedAt: number };

export const IDLE_SHOW_CLOCK: ShowClock = { status: "idle" };

export const SHOW_CLOCK_KEY_PREFIX = "bandmate_show_clock_";

export const SHOW_CLOCK_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** localStorage key: `bandmate_show_clock_{userId}_{setlistId}`. */
export function showClockKey(userId: string, setlistId: string): string {
  return `${SHOW_CLOCK_KEY_PREFIX}${userId}_${setlistId}`;
}

export function showClockElapsedMs(clock: ShowClock, now: number = Date.now()): number {
  if (clock.status === "running") return Math.max(0, now - clock.startedAt);
  if (clock.status === "paused") return clock.elapsedMs;
  return 0;
}

/** Idle → running from now; paused → running from where it stopped. */
export function startShowClock(clock: ShowClock, now: number = Date.now()): ShowClock {
  if (clock.status === "running") return clock;
  return { status: "running", startedAt: now - showClockElapsedMs(clock, now) };
}

export function pauseShowClock(clock: ShowClock, now: number = Date.now()): ShowClock {
  if (clock.status !== "running") return clock;
  return { status: "paused", elapsedMs: showClockElapsedMs(clock, now), pausedAt: now };
}

/** `m:ss` under an hour, `h:mm:ss` from there. */
export function formatShowClock(elapsedMs: number): string {
  const totalSeconds = Math.floor(Math.max(0, elapsedMs) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseShowClock(raw: string | null): ShowClock | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown> | null;
    if (!value || typeof value !== "object") return null;
    if (value.status === "running" && isFiniteNumber(value.startedAt)) {
      return { status: "running", startedAt: value.startedAt };
    }
    if (value.status === "paused" && isFiniteNumber(value.elapsedMs) && value.elapsedMs >= 0 && isFiniteNumber(value.pausedAt)) {
      return { status: "paused", elapsedMs: value.elapsedMs, pausedAt: value.pausedAt };
    }
    return null;
  } catch {
    return null;
  }
}

/** The moment that ages a clock: its start while running, its pause after. */
function lastActivity(clock: ShowClock): number {
  if (clock.status === "running") return clock.startedAt;
  if (clock.status === "paused") return clock.pausedAt;
  return 0;
}

/** Idle when absent, unparsable, or older than 12 h (and then removed). */
export function readShowClock(userId: string, setlistId: string, now: number = Date.now()): ShowClock {
  const key = showClockKey(userId, setlistId);
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return IDLE_SHOW_CLOCK;
    const clock = parseShowClock(raw);
    if (!clock || now - lastActivity(clock) > SHOW_CLOCK_MAX_AGE_MS) {
      localStorage.removeItem(key);
      return IDLE_SHOW_CLOCK;
    }
    return clock;
  } catch (error) {
    console.warn("Could not read the show clock:", error);
    return IDLE_SHOW_CLOCK;
  }
}

/** Idle removes the key. */
export function writeShowClock(userId: string, setlistId: string, clock: ShowClock): void {
  const key = showClockKey(userId, setlistId);
  try {
    if (clock.status === "idle") localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(clock));
  } catch (error) {
    // Full or blocked storage: the clock keeps running in memory.
    console.warn("Could not save the show clock:", error);
  }
}

/** Removes every `bandmate_show_clock_*` key. Called by wipeAll(). */
export function clearAllShowClocks(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(SHOW_CLOCK_KEY_PREFIX)) doomed.push(key);
    }
    doomed.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn("Could not clear show clocks:", error);
  }
}
