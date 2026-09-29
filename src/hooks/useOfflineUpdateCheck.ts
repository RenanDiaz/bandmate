import { useEffect } from "react";
import { useBandContext } from "../context/useBandContext";
import { checkForUpdates } from "../services/offlineSetlistService";

/** §6.3: the connection coming back waits this long before checking, so a flapping signal checks once. */
export const ONLINE_CHECK_DEBOUNCE_MS = 5_000;

/** Runs the check and swallows everything: results land in the snapshot metas (events), never in a toast. */
export function runUpdateCheck(setlistIds?: string[]): Promise<void> {
  return checkForUpdates(setlistIds).then(
    () => undefined,
    (error: unknown) => console.warn("Offline update check did not run:", error)
  );
}

/**
 * §6.3, "opening a snapshot's detail online": checks that one setlist when the
 * detail opens with a session and a connection (and again when both return).
 * A setlist with no offline copy costs one local read and no request.
 */
export function useOfflineUpdateCheckOnOpen(setlistId: string | undefined): void {
  const { authMode, isOnline } = useBandContext();
  const eligible = !!setlistId && authMode === "session" && isOnline;

  useEffect(() => {
    if (!eligible || !setlistId) return;
    void runUpdateCheck([setlistId]);
  }, [eligible, setlistId]);
}
