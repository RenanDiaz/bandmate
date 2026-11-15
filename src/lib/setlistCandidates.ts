/**
 * Setlist candidates (docs/specs/setlist-builder.md §5, Phase 3): a
 * per-device shortlist of songs a member is considering for one setlist.
 * Stored per user and setlist in localStorage, like the performance
 * position; a list untouched for 30 days is discarded on read. `wipeAll()`
 * removes every key (they identify setlists).
 */

export const SETLIST_CANDIDATES_KEY_PREFIX = "bandmate_setlist_candidates_";

export const SETLIST_CANDIDATES_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** localStorage key: `bandmate_setlist_candidates_{userId}_{setlistId}`. */
export function setlistCandidatesKey(userId: string, setlistId: string): string {
  return `${SETLIST_CANDIDATES_KEY_PREFIX}${userId}_${setlistId}`;
}

interface StoredCandidates {
  songIds: string[];
  /** ISO */
  savedAt: string;
}

function parseCandidates(raw: string | null): StoredCandidates | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredCandidates> | null;
    if (!value || typeof value !== "object") return null;
    if (!Array.isArray(value.songIds) || !value.songIds.every((id) => typeof id === "string")) return null;
    if (typeof value.savedAt !== "string" || Number.isNaN(Date.parse(value.savedAt))) return null;
    return { songIds: [...new Set(value.songIds)], savedAt: value.savedAt };
  } catch {
    return null;
  }
}

/** Song ids in starring order; [] when absent, unparsable or older than 30 days (then removed). */
export function readCandidates(userId: string, setlistId: string, now: number = Date.now()): string[] {
  const key = setlistCandidatesKey(userId, setlistId);
  try {
    const raw = localStorage.getItem(key);
    const stored = parseCandidates(raw);
    if (raw !== null && (!stored || now - Date.parse(stored.savedAt) > SETLIST_CANDIDATES_MAX_AGE_MS)) {
      localStorage.removeItem(key);
      return [];
    }
    return stored?.songIds ?? [];
  } catch (error) {
    console.warn("Could not read the setlist candidates:", error);
    return [];
  }
}

/** An empty list removes the key. */
export function writeCandidates(userId: string, setlistId: string, songIds: string[], now: Date = new Date()): void {
  const key = setlistCandidatesKey(userId, setlistId);
  try {
    if (songIds.length === 0) {
      localStorage.removeItem(key);
      return;
    }
    const stored: StoredCandidates = { songIds: [...new Set(songIds)], savedAt: now.toISOString() };
    localStorage.setItem(key, JSON.stringify(stored));
  } catch (error) {
    // Full or blocked storage: the shortlist is a convenience, the editor goes on.
    console.warn("Could not save the setlist candidates:", error);
  }
}

/** Removes every `bandmate_setlist_candidates_*` key. Called by wipeAll(). */
export function clearAllCandidates(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(SETLIST_CANDIDATES_KEY_PREFIX)) doomed.push(key);
    }
    doomed.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn("Could not clear setlist candidates:", error);
  }
}
