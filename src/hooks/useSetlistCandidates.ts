import { useCallback, useEffect, useState } from "react";
import { readCandidates, writeCandidates } from "../lib/setlistCandidates";

export interface SetlistCandidates {
  /** Stored song ids, in starring order. */
  ids: string[];
  toggle: (songId: string) => void;
  /** Drops these songs from the list (they made it into the saved setlist). */
  remove: (songIds: Iterable<string>) => void;
}

/**
 * This user's candidates for one setlist (setlist-builder §5), read from and
 * written to localStorage. Empty, and a no-op, without a user or setlist.
 */
export function useSetlistCandidates(userId: string | undefined, setlistId: string | undefined): SetlistCandidates {
  const [ids, setIds] = useState<string[]>(() => (userId && setlistId ? readCandidates(userId, setlistId) : []));

  // Another user or setlist: reload (the hook stays mounted across routes).
  useEffect(() => {
    setIds(userId && setlistId ? readCandidates(userId, setlistId) : []);
  }, [userId, setlistId]);

  const update = useCallback(
    (next: (current: string[]) => string[]) => {
      if (!userId || !setlistId) return;
      setIds((current) => {
        const result = next(current);
        if (result === current) return current;
        writeCandidates(userId, setlistId, result);
        return result;
      });
    },
    [userId, setlistId]
  );

  const toggle = useCallback(
    (songId: string) =>
      update((current) => (current.includes(songId) ? current.filter((id) => id !== songId) : [...current, songId])),
    [update]
  );

  const remove = useCallback(
    (songIds: Iterable<string>) => {
      const doomed = new Set(songIds);
      update((current) => (current.some((id) => doomed.has(id)) ? current.filter((id) => !doomed.has(id)) : current));
    },
    [update]
  );

  return { ids, toggle, remove };
}
