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
  isCheckingAuth: boolean;
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
    let mounted = true;
    // Resolve the user from the locally stored session first: it needs no
    // network, so an offline device with a valid session isn't treated as
    // logged out. getUser() then revalidates against the auth server, but only
    // online, and only ever to confirm a user — a failure never clears one.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      const sessionUser = session?.user ?? null;
      setUser((prev) => (prev?.id === sessionUser?.id ? prev : sessionUser));
      setHasCheckedAuth(true);

      if (!sessionUser || !navigator.onLine) return;
      supabase.auth
        .getUser()
        .then(({ data: { user: verified } }) => {
          if (!mounted || !verified) return;
          setUser((prev) => (prev?.id === verified.id ? prev : verified));
        })
        .catch(() => {
          // Network hiccup: keep the session user.
        });
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      // Only update the user state when it actually changes. Supabase refreshes
      // the token (firing TOKEN_REFRESHED / SIGNED_IN) when the tab regains
      // focus, e.g. after switching apps and coming back. Replacing `user` with
      // a new reference on every such event would re-run the effects below and
      // refetch all band data, making the app look like it reloads.
      setUser((prev) => (prev?.id === nextUser?.id ? prev : nextUser));
      setHasCheckedAuth(true);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
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
        isCheckingAuth: !hasCheckedAuth,
      }}
    >
      {children}
    </BandContext.Provider>
  );
};

// Export BandContext for use in useBandContext.ts
export { BandContext };
