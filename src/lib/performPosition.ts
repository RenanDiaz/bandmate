/**
 * Performance-mode position persisted in localStorage (spec §3.2, §9.4, A2),
 * so a relaunch during a show (iOS kills the PWA; sessionStorage does not
 * survive that) returns to the same song, view and PDF. Positions older than
 * 12 hours are discarded on read. `wipeAll()` removes every key (they
 * identify setlists).
 */

export const PERFORM_POSITION_KEY_PREFIX = "bandmate_perform_position_";

/** localStorage key: `bandmate_perform_position_{userId}_{setlistId}`. */
export function performPositionKey(userId: string, setlistId: string): string {
  return `${PERFORM_POSITION_KEY_PREFIX}${userId}_${setlistId}`;
}

/** Removes every `bandmate_perform_position_*` key. Called by wipeAll(). */
export function clearAllPerformPositions(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(PERFORM_POSITION_KEY_PREFIX)) doomed.push(key);
    }
    doomed.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    // localStorage can throw (blocked storage, private modes); nothing to clear then.
    console.warn("Could not clear performance positions:", error);
  }
}

export interface PerformPosition {
  currentIndex: number;
  contentView: "chords" | "lyrics" | "sheetMusic";
  selectedSheetMusicId: string | null;
  /** ISO */
  savedAt: string;
}

export const PERFORM_POSITION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

const CONTENT_VIEWS: ReadonlyArray<PerformPosition["contentView"]> = ["chords", "lyrics", "sheetMusic"];

function parsePosition(raw: string | null): PerformPosition | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PerformPosition> | null;
    if (!value || typeof value !== "object") return null;
    if (typeof value.currentIndex !== "number" || !Number.isInteger(value.currentIndex) || value.currentIndex < 0) return null;
    if (!CONTENT_VIEWS.includes(value.contentView as PerformPosition["contentView"])) return null;
    if (value.selectedSheetMusicId !== null && typeof value.selectedSheetMusicId !== "string") return null;
    if (typeof value.savedAt !== "string" || Number.isNaN(Date.parse(value.savedAt))) return null;
    return {
      currentIndex: value.currentIndex,
      contentView: value.contentView as PerformPosition["contentView"],
      selectedSheetMusicId: value.selectedSheetMusicId ?? null,
      savedAt: value.savedAt,
    };
  } catch {
    return null;
  }
}

/** null when absent, unparsable, or savedAt older than 12 h (and then removed). */
export function readPerformPosition(userId: string, setlistId: string, now: number = Date.now()): PerformPosition | null {
  const key = performPositionKey(userId, setlistId);
  try {
    const raw = localStorage.getItem(key);
    const position = parsePosition(raw);
    if (raw !== null && (!position || now - Date.parse(position.savedAt) > PERFORM_POSITION_MAX_AGE_MS)) {
      localStorage.removeItem(key);
      return null;
    }
    return position;
  } catch (error) {
    console.warn("Could not read the performance position:", error);
    return null;
  }
}

export function writePerformPosition(
  userId: string,
  setlistId: string,
  position: Omit<PerformPosition, "savedAt">,
  now: Date = new Date()
): void {
  try {
    localStorage.setItem(performPositionKey(userId, setlistId), JSON.stringify({ ...position, savedAt: now.toISOString() }));
  } catch (error) {
    // Full or blocked storage: the position is a convenience, performance mode goes on.
    console.warn("Could not save the performance position:", error);
  }
}
