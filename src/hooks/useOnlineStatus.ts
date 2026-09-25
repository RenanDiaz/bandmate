import { useCallback, useEffect, useRef, useState } from "react";

/** How long a failed request keeps the app offline while the browser says online. */
export const NETWORK_FAILURE_OFFLINE_MS = 30_000;

export interface OnlineStatus {
  /** `false` when the browser is offline or a request failed in the last 30 s. */
  isOnline: boolean;
  /**
   * Call after a request fails on the network. `navigator.onLine` stays `true`
   * behind a captive portal or on a signal with no data, so this forces
   * offline for 30 s (each call restarts the window). Leaves `isOnline` alone
   * when the browser already reports offline.
   */
  reportNetworkFailure: () => void;
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

  const clearFailure = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setFailureActive(false);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      // A real reconnect ends a forced-offline window early.
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
    if (timerRef.current) clearTimeout(timerRef.current);
    setFailureActive(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setFailureActive(false);
    }, NETWORK_FAILURE_OFFLINE_MS);
  }, []);

  return { isOnline: browserOnline && !failureActive, reportNetworkFailure };
}
