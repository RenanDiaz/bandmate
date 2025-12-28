import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import {
  createSession,
  endSession,
  getActiveSessionWithHost,
  subscribeToSession,
  unsubscribeFromSession,
  updateSongIndex,
  forceEndSession as forceEndSessionService,
  takeOverSession as takeOverSessionService,
  getHostDisplayName,
} from "../services/performanceSessionService";
import type { PerformanceSession } from "../services/performanceSessionService";
import { getUserBandRole } from "../services/bandMembersService";

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

  // Orphaned session management (for band owners)
  forceEndSession: () => Promise<void>;
  takeOverSession: () => Promise<void>;

  // Session info
  hasActiveSession: boolean;
  activeSessionSetlistId: string | null;
  hostDisplayName: string | null;
  sessionCreatedAt: string | null;
  canManageOrphanedSession: boolean;
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
  const [isOwner, setIsOwner] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const onSongIndexChangeRef = useRef(onSongIndexChange);
  const sessionRef = useRef<PerformanceSession | null>(null);
  const roleRef = useRef<SyncRole>(null);

  // Keep refs updated for beforeunload handler
  useEffect(() => {
    sessionRef.current = session;
    roleRef.current = role;
  }, [session, role]);

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
      const activeSession = await getActiveSessionWithHost(bandId);

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

  // Force end orphaned session (for band owners)
  const forceEndSession = useCallback(async () => {
    if (!existingSession) return;

    setIsLoading(true);
    try {
      await forceEndSessionService(existingSession.id);
      setExistingSession(null);
      setSession(null);
      setRole(null);
      setIsConnected(false);
      if (channelRef.current) {
        await unsubscribeFromSession(channelRef.current);
        channelRef.current = null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cerrar sesión");
    } finally {
      setIsLoading(false);
    }
  }, [existingSession]);

  // Take over orphaned session (become the new host)
  const takeOverSession = useCallback(async () => {
    if (!existingSession) return;

    setIsLoading(true);
    try {
      const updatedSession = await takeOverSessionService(existingSession.id);
      // Get our display name for the updated session
      const { data: userData } = await supabase.auth.getUser();
      const hostName = userData.user?.id
        ? await getHostDisplayName(userData.user.id)
        : null;

      const sessionWithHost = {
        ...updatedSession,
        host_display_name: hostName || undefined,
      };

      setSession(sessionWithHost);
      setExistingSession(sessionWithHost);
      setRole("host");
      subscribeToUpdates(sessionWithHost);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al tomar control");
    } finally {
      setIsLoading(false);
    }
  }, [existingSession, subscribeToUpdates]);

  // Check for existing active session and user role on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        // Check user's role in the band
        const userRole = await getUserBandRole(bandId);
        setIsOwner(userRole === "owner");

        // Check for active session with host info
        const activeSession = await getActiveSessionWithHost(bandId);
        if (activeSession) {
          setExistingSession(activeSession);
        }
      } catch {
        // Ignore errors on initial check
      }
    };

    initialize();
  }, [bandId]);

  // Cleanup on beforeunload (attempt to end session if host)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Use refs because state may not be current in event handler
      if (sessionRef.current && roleRef.current === "host") {
        // Use sendBeacon for reliable delivery on page unload
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/performance_sessions?id=eq.${sessionRef.current.id}`;
        const body = JSON.stringify({
          is_active: false,
          updated_at: new Date().toISOString(),
        });

        navigator.sendBeacon(
          url,
          new Blob([body], { type: "application/json" })
        );
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        unsubscribeFromSession(channelRef.current);
      }
    };
  }, []);

  // Determine if user can manage orphaned session
  // User can manage if: they are owner AND there's an active session AND they are NOT the host
  const canManageOrphanedSession =
    isOwner &&
    existingSession !== null &&
    existingSession.is_active &&
    role !== "host";

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
    forceEndSession,
    takeOverSession,
    hasActiveSession: existingSession !== null && existingSession.is_active,
    activeSessionSetlistId: existingSession?.setlist_id ?? null,
    hostDisplayName: existingSession?.host_display_name ?? null,
    sessionCreatedAt: existingSession?.created_at ?? null,
    canManageOrphanedSession,
  };
}
