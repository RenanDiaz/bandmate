import { useBandContext } from "../../context/useBandContext";
import { isOfflineDownloadsEnabled } from "../../lib/featureFlags";

/**
 * Whether routes render their offline screen (spec §7.3): the flag is on, a
 * user is known ("session" or "offline-cached") and the context says offline.
 * The context's `isOnline` includes `reportNetworkFailure()`'s forced-offline
 * window (30 s, doubling on consecutive failures up to 5 min), so
 * weak signal counts as offline. When it turns true again the same route
 * renders its online view: nothing navigates.
 */
export function useOfflineUi(): boolean {
  const { isOnline, user } = useBandContext();
  return isOfflineDownloadsEnabled() && !isOnline && !!user;
}
