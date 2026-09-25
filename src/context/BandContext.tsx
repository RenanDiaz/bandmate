import type { ReactNode } from "react";
import { createContext, useState, useEffect, useCallback, useRef } from "react";
import type { Band } from "../services/bandsService";
import { getMyBands } from "../services/bandsService";
import {
  confirmSignedInUser,
  getLastUserId,
  listOfflineBands,
  setOfflineCurrentUser,
} from "../services/offlineSetlistService";
import { BandStorage } from "../lib/BandStorage";
import { supabase } from "../lib/supabaseClient";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import type { AppUser, AuthMode, AuthState } from "./offlineAuthController";
import { OfflineAuthController } from "./offlineAuthController";

interface BandContextType {
  selectedBand: Band | null;
  setSelectedBand: (band: Band | null) => void;
  /** A full Supabase `User` in "session"; a minimal `OfflineUser` (`{ id }`) in "offline-cached". */
  user: AppUser | null;
  /** How `user` was resolved (spec §7.1); see src/context/offlineAuthController.ts. */
  authMode: AuthMode;
  setShowBandSelector: (show: boolean) => void;
  showBandSelector: boolean;
  bands: Band[];
  refreshBands: () => void;
  isResolvingBand: boolean;
  isCheckingAuth: boolean;
  /** Shared `useOnlineStatus()` value; see src/hooks/useOnlineStatus.ts. */
  isOnline: boolean;
  reportNetworkFailure: () => void;
}

const BandContext = createContext<BandContextType | undefined>(undefined);

/** Picks the saved band, else the only one, else none (§7.2). */
function pickBand(bands: Band[]): Band | null {
  const savedBandId = BandStorage.getSelectedBandId();
  const saved = savedBandId ? bands.find((b) => String(b.id) === savedBandId) : undefined;
  return saved ?? (bands.length === 1 ? bands[0] : null);
}

export const BandProvider = ({ children }: { children: ReactNode }) => {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    authMode: "signed-out",
    isCheckingAuth: true,
    provisional: false,
  });
  const [selectedBand, setSelectedBand] = useState<Band | null>(null);
  const [showBandSelector, setShowBandSelector] = useState(false);
  const [bands, setBands] = useState<Band[]>([]);
  const [isResolvingBand, setIsResolvingBand] = useState(!!BandStorage.getSelectedBandId());
  const { isOnline, reportNetworkFailure } = useOnlineStatus();
  const { user, authMode, isCheckingAuth } = auth;

  // The controller is created once; these refs give it the latest values.
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;
  const reportNetworkFailureRef = useRef(reportNetworkFailure);
  reportNetworkFailureRef.current = reportNetworkFailure;
  const controllerRef = useRef<OfflineAuthController | null>(null);

  // Auth state (§7.1): session first; offline, getSession() is raced against
  // a 1.5 s timeout and `last-user` resolves "offline-cached" provisionally;
  // an involuntary SIGNED_OUT hides offline copies instead of deleting them.
  useEffect(() => {
    const controller = new OfflineAuthController({
      auth: supabase.auth,
      offline: { getLastUserId, confirmSignedInUser, setOfflineCurrentUser },
      isOnline: () => isOnlineRef.current,
      reportNetworkFailure: () => reportNetworkFailureRef.current(),
      // Only a confirmed "nobody is signed in" forgets the saved band; a
      // provisional, cached or lost session keeps it for when it comes back.
      onConfirmedSignedOut: () => BandStorage.clearSelectedBandId(),
    });
    controllerRef.current = controller;
    const unsubscribe = controller.subscribe(setAuth);
    controller.start();
    return () => {
      unsubscribe();
      controller.stop();
      controllerRef.current = null;
    };
  }, []);

  // Back online in "offline-cached": ask getSession() again (a session →
  // "session"; a retryable error → stay; anything else → "session-lost").
  useEffect(() => {
    if (isOnline && authMode === "offline-cached") void controllerRef.current?.recheck();
  }, [isOnline, authMode]);

  // Bands: from the server with a session; from offline copies in
  // "offline-cached" or when the server can't be reached (§7.2).
  const loadBands = useCallback(async (): Promise<Band[]> => {
    if (!user) return [];
    if (authMode === "offline-cached") return listOfflineBands();
    try {
      return await getMyBands();
    } catch {
      reportNetworkFailure();
      return listOfflineBands();
    }
  }, [user, authMode, reportNetworkFailure]);

  const refreshBands = useCallback(() => {
    loadBands().then(setBands);
  }, [loadBands]);

  // Load bands and resolve the selected one. isResolvingBand always ends, so
  // a failed load renders the no-band UI instead of a spinner.
  useEffect(() => {
    if (isCheckingAuth) return;
    if (!user) {
      setBands([]);
      setSelectedBand(null);
      setIsResolvingBand(false);
      return;
    }
    let cancelled = false;
    loadBands()
      .then((loaded) => {
        if (cancelled) return;
        setBands(loaded);
        setSelectedBand(pickBand(loaded));
      })
      .catch(() => {
        // listOfflineBands never rejects; this only guards the unexpected.
        if (!cancelled) setBands([]);
      })
      .finally(() => {
        if (!cancelled) setIsResolvingBand(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, isCheckingAuth, loadBands]);

  // Save selected band to storage
  useEffect(() => {
    if (selectedBand) {
      BandStorage.setSelectedBandId(selectedBand.id);
    }
    // Do NOT clear localStorage here if selectedBand is null
  }, [selectedBand]);

  return (
    <BandContext.Provider
      value={{
        selectedBand,
        setSelectedBand,
        user,
        authMode,
        setShowBandSelector,
        showBandSelector,
        bands,
        refreshBands,
        isResolvingBand,
        isCheckingAuth,
        isOnline,
        reportNetworkFailure,
      }}
    >
      {children}
    </BandContext.Provider>
  );
};

// Export BandContext for use in useBandContext.ts
export { BandContext };
