/**
 * Performance-mode position persisted in localStorage (spec §3.2, A2).
 *
 * PR 2.2a ships only the key layout and the wipe, because `wipeAll()` must
 * already remove these keys (they identify setlists). Reading and writing the
 * position arrives with performance mode's snapshot source (PR 2.4).
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
