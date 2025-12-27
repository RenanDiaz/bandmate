import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  createSession,
  endSession,
  getActiveSessionForSetlist,
  getSessionByCode,
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
  joinSession: (code: string) => Promise<boolean>;
  leaveSession: () => Promise<void>;
  syncSongIndex: (index: number) => Promise<void>;

  // Session info
  sessionCode: string | null;
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
      subscribeToUpdates(newSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear sesión");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [setlistId, bandId, subscribeToUpdates]);

  // Join an existing session by code
  const joinSession = useCallback(
    async (code: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const existingSession = await getSessionByCode(code);

        if (!existingSession) {
          setError("Sesión no encontrada o ya no está activa");
          return false;
        }

        // Verify it's for the same setlist
        if (existingSession.setlist_id !== setlistId) {
          setError("Esta sesión es para otro setlist");
          return false;
        }

        setSession(existingSession);
        setRole("viewer");
        subscribeToUpdates(existingSession);

        // Immediately sync to current position
        if (onSongIndexChangeRef.current) {
          onSongIndexChangeRef.current(existingSession.current_song_index);
        }

        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al unirse");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [setlistId, subscribeToUpdates]
  );

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
        const existingSession = await getActiveSessionForSetlist(setlistId);
        if (existingSession) {
          // There's an active session - user can choose to join
          // We don't auto-join, just make it available
        }
      } catch {
        // Ignore errors on initial check
      }
    };

    checkExistingSession();
  }, [setlistId]);

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
    joinSession,
    leaveSession,
    syncSongIndex,
    sessionCode: session?.session_code ?? null,
  };
}
