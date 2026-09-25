import { useCallback, useEffect, useRef, useState } from "react";

/** The first forced-offline window after a failed request while the browser says online. */
export const NETWORK_FAILURE_OFFLINE_MS = 30_000;
/** The longest forced-offline window, however many failures in a row. */
export const NETWORK_FAILURE_MAX_OFFLINE_MS = 5 * 60_000;

/**
 * Window length after the `failures`-th consecutive failure (1-based):
 * 30 s, 60 s, 120 s, 240 s, then 5 min.
 */
export function forcedOfflineMs(failures: number): number {
  const doublings = Math.max(0, failures - 1);
  return Math.min(NETWORK_FAILURE_OFFLINE_MS * 2 ** doublings, NETWORK_FAILURE_MAX_OFFLINE_MS);
}

export interface OnlineStatus {
  /** `false` when the browser is offline or inside a forced-offline window. */
  isOnline: boolean;
  /**
   * Call after a request fails on the network. `navigator.onLine` stays `true`
   * behind a captive portal or on a signal with no data, so this forces
   * offline for a while. Each failure *after* a window has ended (the retry
   * failed too) doubles the next window: 30 s, 60 s, 120 s… capped at 5 min.
   * Failures inside a running window are the same outage: they restart it at
   * its current length. Leaves `isOnline` alone when the browser already
   * reports offline.
   */
  reportNetworkFailure: () => void;
  /**
   * Call after a request reached the server. Resets the backoff, so the next
   * failure starts again at 30 s. It does not end a running window: a
   * service-worker cache answer looks like a success too.
   */
  reportNetworkSuccess: () => void;
}

/**
 * Online/offline state seeded from `navigator.onLine` and kept current with
 * the `online`/`offline` events. Use it through `useBandContext()` so the
 * whole tree shares one value — calling this hook again creates an
 * independent copy that won't see `reportNetworkFailure()` from elsewhere.
 */
export function useOnlineStatus(): OnlineStatus {
  const [browserOnline, setBrowserOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [failureActive, setFailureActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Consecutive failures (windows opened) since the last success or `online` event.
  const failuresRef = useRef(0);
  const windowMsRef = useRef(NETWORK_FAILURE_OFFLINE_MS);

  const clearFailure = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    failuresRef.current = 0;
    setFailureActive(false);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      // A real reconnect ends a forced-offline window early and resets the backoff.
      clearFailure();
      setBrowserOnline(true);
    };
    const handleOffline = () => setBrowserOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [clearFailure]);

  const reportNetworkFailure = useCallback(() => {
    if (!navigator.onLine) return;
    if (timerRef.current) {
      // Same outage: restart the running window at its current length.
      clearTimeout(timerRef.current);
    } else {
      failuresRef.current += 1;
      windowMsRef.current = forcedOfflineMs(failuresRef.current);
    }
    setFailureActive(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setFailureActive(false);
    }, windowMsRef.current);
  }, []);

  const reportNetworkSuccess = useCallback(() => {
    failuresRef.current = 0;
  }, []);

  return { isOnline: browserOnline && !failureActive, reportNetworkFailure, reportNetworkSuccess };
}
