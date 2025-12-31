import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

export interface PerformanceSession {
  id: string;
  setlist_id: string;
  band_id: number;
  host_user_id: string;
  current_song_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Audio sync fields
  current_time_ms: number;
  is_playing: boolean;
  playback_updated_at: string | null;
  // Populated via join or separate query
  host_display_name?: string;
}

export interface CreateSessionInput {
  setlist_id: string;
  band_id: number;
}

/**
 * Create a new performance session (caller becomes host)
 * Only one active session per band is allowed
 */
export async function createSession(
  input: CreateSessionInput
): Promise<PerformanceSession> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  // First, deactivate any existing sessions for this band
  await supabase
    .from("performance_sessions")
    .update({ is_active: false })
    .eq("band_id", input.band_id)
    .eq("is_active", true);

  // Create new session for the band
  const { data, error } = await supabase
    .from("performance_sessions")
    .insert([
      {
        setlist_id: input.setlist_id,
        band_id: input.band_id,
        host_user_id: user.id,
        current_song_index: 0,
        is_active: true,
      },
    ])
    .select()
    .single();

  if (error) throw error;

  return data;
}

/**
 * Get an active session for a band
 */
export async function getActiveSessionForBand(
  bandId: number
): Promise<PerformanceSession | null> {
  const { data, error } = await supabase
    .from("performance_sessions")
    .select("*")
    .eq("band_id", bandId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }

  return data;
}

/**
 * Update the current song index (host only)
 */
export async function updateSongIndex(
  sessionId: string,
  songIndex: number
): Promise<void> {
  const { error } = await supabase
    .from("performance_sessions")
    .update({
      current_song_index: songIndex,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) throw error;
}

/**
 * Update audio playback state (host only)
 * Used to sync audio position and play/pause state to viewers
 */
export async function updatePlaybackState(
  sessionId: string,
  currentTimeMs: number,
  isPlaying: boolean
): Promise<void> {
  const { error } = await supabase
    .from("performance_sessions")
    .update({
      current_time_ms: currentTimeMs,
      is_playing: isPlaying,
      playback_updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) throw error;
}

/**
 * End a session (host only)
 */
export async function endSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("performance_sessions")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) throw error;
}

/**
 * Subscribe to session changes via Supabase Realtime
 * Returns channel for cleanup
 */
export function subscribeToSession(
  sessionId: string,
  onUpdate: (session: PerformanceSession) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`performance_session:${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "performance_sessions",
        filter: `id=eq.${sessionId}`,
      },
      (payload) => {
        onUpdate(payload.new as PerformanceSession);
      }
    )
    .subscribe();

  return channel;
}

/**
 * Unsubscribe from session changes
 */
export async function unsubscribeFromSession(
  channel: RealtimeChannel
): Promise<void> {
  await supabase.removeChannel(channel);
}

/**
 * Check if current user is the host of a session
 */
export async function isSessionHost(sessionId: string): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return false;

  const { data } = await supabase
    .from("performance_sessions")
    .select("host_user_id")
    .eq("id", sessionId)
    .single();

  return data?.host_user_id === user.id;
}

/**
 * Get the display name of a session host
 */
export async function getHostDisplayName(
  hostUserId: string
): Promise<string | null> {
  try {
    const { data } = await supabase.rpc("get_user_display_name", {
      user_id_param: hostUserId,
    });
    return data || null;
  } catch {
    return null;
  }
}

/**
 * Get active session for a band with host display name
 */
export async function getActiveSessionWithHost(
  bandId: number
): Promise<PerformanceSession | null> {
  const session = await getActiveSessionForBand(bandId);
  if (!session) return null;

  const hostName = await getHostDisplayName(session.host_user_id);
  return {
    ...session,
    host_display_name: hostName || undefined,
  };
}

/**
 * Force end a session (for band owners to close orphaned sessions)
 */
export async function forceEndSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("performance_sessions")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) throw error;
}

/**
 * Take over an existing session (become the new host)
 */
export async function takeOverSession(
  sessionId: string
): Promise<PerformanceSession> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("performance_sessions")
    .update({
      host_user_id: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
