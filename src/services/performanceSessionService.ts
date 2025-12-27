import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

export interface PerformanceSession {
  id: string;
  setlist_id: string;
  band_id: number;
  host_user_id: string;
  current_song_index: number;
  session_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSessionInput {
  setlist_id: string;
  band_id: number;
}

/**
 * Generate a random 6-character session code
 */
function generateSessionCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Create a new performance session (caller becomes host)
 */
export async function createSession(
  input: CreateSessionInput
): Promise<PerformanceSession> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  // First, deactivate any existing sessions for this setlist by this user
  await supabase
    .from("performance_sessions")
    .update({ is_active: false })
    .eq("setlist_id", input.setlist_id)
    .eq("host_user_id", user.id);

  // Create new session with unique code
  let sessionCode = generateSessionCode();
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    const { data, error } = await supabase
      .from("performance_sessions")
      .insert([
        {
          setlist_id: input.setlist_id,
          band_id: input.band_id,
          host_user_id: user.id,
          session_code: sessionCode,
          current_song_index: 0,
          is_active: true,
        },
      ])
      .select()
      .single();

    if (error) {
      // If code collision, try a new code
      if (error.code === "23505") {
        sessionCode = generateSessionCode();
        attempts++;
        continue;
      }
      throw error;
    }

    return data;
  }

  throw new Error("Failed to generate unique session code");
}

/**
 * Get an active session by session code
 */
export async function getSessionByCode(
  sessionCode: string
): Promise<PerformanceSession | null> {
  const { data, error } = await supabase
    .from("performance_sessions")
    .select("*")
    .eq("session_code", sessionCode.toUpperCase())
    .eq("is_active", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }

  return data;
}

/**
 * Get an active session for a setlist
 */
export async function getActiveSessionForSetlist(
  setlistId: string
): Promise<PerformanceSession | null> {
  const { data, error } = await supabase
    .from("performance_sessions")
    .select("*")
    .eq("setlist_id", setlistId)
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
