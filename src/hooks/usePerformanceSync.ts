import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import {
  createSession,
  endSession,
  getActiveSessionForBand,
  subscribeToSession,
  unsubscribeFromSession,
  updateSongIndex,
} from "../services/performanceSessionService";
import type { PerformanceSession } from "../services/performanceSessionService";

export type SyncRole = "host" | "viewer" | null;

export interface UsePerformanceSyncOptions {
  setlistId: string;
  bandId: number;
  onSongIndexChange?: (index: number) => void;
}

export interface UsePerformanceSyncReturn {
  // State
  session: PerformanceSession | null;
  role: SyncRole;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  startHosting: () => Promise<void>;
  joinExistingSession: () => Promise<boolean>;
  leaveSession: () => Promise<void>;
  syncSongIndex: (index: number) => Promise<void>;

  // Session info
  hasActiveSession: boolean;
  activeSessionSetlistId: string | null;
}

export function usePerformanceSync({
  setlistId,
  bandId,
  onSongIndexChange,
}: UsePerformanceSyncOptions): UsePerformanceSyncReturn {
  const [session, setSession] = useState<PerformanceSession | null>(null);
  const [role, setRole] = useState<SyncRole>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingSession, setExistingSession] =
    useState<PerformanceSession | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const onSongIndexChangeRef = useRef(onSongIndexChange);

  // Keep callback ref updated
  useEffect(() => {
    onSongIndexChangeRef.current = onSongIndexChange;
  }, [onSongIndexChange]);

  // Subscribe to session updates
  const subscribeToUpdates = useCallback((sessionData: PerformanceSession) => {
    // Cleanup existing subscription
    if (channelRef.current) {
      unsubscribeFromSession(channelRef.current);
    }

    const channel = subscribeToSession(sessionData.id, (updatedSession) => {
      setSession(updatedSession);

      // If session was deactivated, disconnect
      if (!updatedSession.is_active) {
        setRole(null);
        setIsConnected(false);
        setSession(null);
        setExistingSession(null);
        if (channelRef.current) {
          unsubscribeFromSession(channelRef.current);
          channelRef.current = null;
        }
        return;
      }

      // Notify about song index change (for viewers)
      if (onSongIndexChangeRef.current) {
        onSongIndexChangeRef.current(updatedSession.current_song_index);
      }
    });

    channelRef.current = channel;
    setIsConnected(true);
  }, []);

  // Start hosting a new session
  const startHosting = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const newSession = await createSession({
        setlist_id: setlistId,
        band_id: bandId,
      });

      setSession(newSession);
      setRole("host");
      setExistingSession(newSession);
      subscribeToUpdates(newSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear sesión");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [setlistId, bandId, subscribeToUpdates]);

  // Join existing session for the band (auto-join)
  const joinExistingSession = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const activeSession = await getActiveSessionForBand(bandId);

      if (!activeSession) {
        setError("No hay sesión activa para esta banda");
        return false;
      }

      // Get current user to check if they're the host
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData.user?.id;

      setSession(activeSession);
      setExistingSession(activeSession);

      // If the current user is the host, set role as host
      if (currentUserId && activeSession.host_user_id === currentUserId) {
        setRole("host");
      } else {
        setRole("viewer");
      }

      subscribeToUpdates(activeSession);

      // Immediately sync to current position
      if (onSongIndexChangeRef.current) {
        onSongIndexChangeRef.current(activeSession.current_song_index);
      }

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al unirse");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [bandId, subscribeToUpdates]);

  // Leave/end session
  const leaveSession = useCallback(async () => {
    if (!session) return;

    try {
      // If host, end the session for everyone
      if (role === "host") {
        await endSession(session.id);
      }

      // Cleanup subscription
      if (channelRef.current) {
        await unsubscribeFromSession(channelRef.current);
        channelRef.current = null;
      }

      setSession(null);
      setRole(null);
      setIsConnected(false);
      setExistingSession(null);
    } catch (err) {
      console.error("Error leaving session:", err);
    }
  }, [session, role]);

  // Sync song index (host only)
  const syncSongIndex = useCallback(
    async (index: number) => {
      if (!session || role !== "host") return;

      try {
        await updateSongIndex(session.id, index);
      } catch (err) {
        console.error("Error syncing song index:", err);
      }
    },
    [session, role]
  );

  // Check for existing active session on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const activeSession = await getActiveSessionForBand(bandId);
        if (activeSession) {
          setExistingSession(activeSession);
        }
      } catch {
        // Ignore errors on initial check
      }
    };

    checkExistingSession();
  }, [bandId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        unsubscribeFromSession(channelRef.current);
      }
    };
  }, []);

  return {
    session,
    role,
    isConnected,
    isLoading,
    error,
    startHosting,
    joinExistingSession,
    leaveSession,
    syncSongIndex,
    hasActiveSession: existingSession !== null && existingSession.is_active,
    activeSessionSetlistId: existingSession?.setlist_id ?? null,
  };
}
