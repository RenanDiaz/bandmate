import type { ReactNode } from "react";
import { createContext, useState, useEffect, useCallback } from "react";
import type { Band } from "../services/bandsService";
import { getMyBands } from "../services/bandsService";
import { BandStorage } from "../lib/BandStorage";
import { supabase } from "../lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

interface BandContextType {
  selectedBand: Band | null;
  setSelectedBand: (band: Band | null) => void;
  user: User | null;
  setShowBandSelector: (show: boolean) => void;
  showBandSelector: boolean;
  bands: Band[];
  refreshBands: () => void;
  isResolvingBand: boolean;
}

const BandContext = createContext<BandContextType | undefined>(undefined);

export const BandProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [selectedBand, setSelectedBand] = useState<Band | null>(null);
  const [showBandSelector, setShowBandSelector] = useState(false);
  const [bands, setBands] = useState<Band[]>([]);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [isResolvingBand, setIsResolvingBand] = useState(!!BandStorage.getSelectedBandId());

  // Auth state
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setHasCheckedAuth(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setHasCheckedAuth(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Load bands
  const refreshBands = useCallback(() => {
    if (user) {
      getMyBands().then(setBands);
    } else {
      setBands([]);
    }
  }, [user]);

  useEffect(refreshBands, [refreshBands]);

  // Load selected band from storage, or auto-select if user has only one band
  useEffect(() => {
    if (user) {
      const savedBandId = BandStorage.getSelectedBandId();
      getMyBands().then((bands) => {
        if (savedBandId) {
          const found = bands.find((b) => String(b.id) === savedBandId);
          if (found) setSelectedBand(found);
        } else if (bands.length === 1) {
          // Auto-select when user has only one band and nothing saved
          setSelectedBand(bands[0]);
        }
        setIsResolvingBand(false);
      });
    } else {
      setSelectedBand(null);
      setIsResolvingBand(false);
    }
  }, [user]);

  // Save selected band to storage
  useEffect(() => {
    if (selectedBand) {
      BandStorage.setSelectedBandId(selectedBand.id);
    }
    // Do NOT clear localStorage here if selectedBand is null
  }, [selectedBand]);

  // Clear bandId from storage only when user logs out (after auth check)
  useEffect(() => {
    if (hasCheckedAuth && !user) {
      BandStorage.clearSelectedBandId();
    }
  }, [user, hasCheckedAuth]);

  return (
    <BandContext.Provider
      value={{
        selectedBand,
        setSelectedBand,
        user,
        setShowBandSelector,
        showBandSelector,
        bands,
        refreshBands,
        isResolvingBand,
      }}
    >
      {children}
    </BandContext.Provider>
  );
};

// Export BandContext for use in useBandContext.ts
export { BandContext };
