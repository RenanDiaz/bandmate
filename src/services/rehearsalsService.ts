import { supabase } from "../lib/supabaseClient";
import { canUserManageEvents } from "./bandMembersService";
import { getLocalToday } from "../lib/dateUtils";
import { PermissionError } from "./permissionError";

export type RehearsalStatus = "scheduled" | "completed" | "cancelled";

export interface Rehearsal {
  id: string;
  band_id: number;
  user_id: string;
  show_id?: string | null;
  setlist_id?: string | null;
  name?: string;
  location?: string;
  rehearsal_date: string;
  start_time?: string;
  end_time?: string;
  notes?: string;
  status: RehearsalStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateRehearsalInput {
  band_id: number;
  show_id?: string;
  setlist_id?: string;
  name?: string;
  location?: string;
  rehearsal_date: string;
  start_time?: string;
  end_time?: string;
  notes?: string;
  status?: RehearsalStatus;
}

export interface UpdateRehearsalInput {
  show_id?: string | null;
  setlist_id?: string | null;
  name?: string;
  location?: string;
  rehearsal_date?: string;
  start_time?: string;
  end_time?: string;
  notes?: string;
  status?: RehearsalStatus;
}

/**
 * Get all rehearsals for a band
 */
export async function getBandRehearsals(bandId: number): Promise<Rehearsal[]> {
  const { data, error } = await supabase
    .from("rehearsals")
    .select("*")
    .eq("band_id", bandId)
    .order("rehearsal_date", { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get upcoming rehearsals for a band
 */
export async function getUpcomingRehearsals(bandId: number): Promise<Rehearsal[]> {
  const today = getLocalToday();

  const { data, error } = await supabase
    .from("rehearsals")
    .select("*")
    .eq("band_id", bandId)
    .eq("status", "scheduled")
    .gte("rehearsal_date", today)
    .order("rehearsal_date", { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get past rehearsals for a band
 */
export async function getPastRehearsals(bandId: number): Promise<Rehearsal[]> {
  const today = getLocalToday();

  const { data, error } = await supabase
    .from("rehearsals")
    .select("*")
    .eq("band_id", bandId)
    .or(`status.eq.completed,rehearsal_date.lt.${today}`)
    .order("rehearsal_date", { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get rehearsals for a specific show
 */
export async function getShowRehearsals(showId: string): Promise<Rehearsal[]> {
  const { data, error } = await supabase
    .from("rehearsals")
    .select("*")
    .eq("show_id", showId)
    .order("rehearsal_date", { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get a single rehearsal by ID
 */
export async function getRehearsal(rehearsalId: string): Promise<Rehearsal> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("rehearsals")
    .select("*")
    .eq("id", rehearsalId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create a new rehearsal
 */
export async function createRehearsal(rehearsal: CreateRehearsalInput): Promise<Rehearsal> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("rehearsals")
    .insert([
      {
        ...rehearsal,
        user_id: user.id,
        status: rehearsal.status || "scheduled",
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update an existing rehearsal
 */
export async function updateRehearsal(rehearsalId: string, updates: UpdateRehearsalInput): Promise<Rehearsal> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  // First get the rehearsal to check band membership
  const { data: rehearsal, error: fetchError } = await supabase
    .from("rehearsals")
    .select("band_id")
    .eq("id", rehearsalId)
    .single();

  if (fetchError) throw fetchError;
  if (!rehearsal) throw new Error("Rehearsal not found");

  // Check if user has permission to manage events in this band
  const hasPermission = await canUserManageEvents(rehearsal.band_id);
  if (!hasPermission) {
    throw new PermissionError("rehearsals.update");
  }

  const { data, error } = await supabase
    .from("rehearsals")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rehearsalId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a rehearsal
 */
export async function deleteRehearsal(rehearsalId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  // First get the rehearsal to check band membership
  const { data: rehearsal, error: fetchError } = await supabase
    .from("rehearsals")
    .select("band_id")
    .eq("id", rehearsalId)
    .single();

  if (fetchError) throw fetchError;
  if (!rehearsal) throw new Error("Rehearsal not found");

  // Check if user has permission to manage events in this band
  const hasPermission = await canUserManageEvents(rehearsal.band_id);
  if (!hasPermission) {
    throw new PermissionError("rehearsals.delete");
  }

  // Ask for the deleted id: RLS filters a refused row out and PostgREST still
  // answers 200, so an empty result is the only sign the delete was refused.
  const { data, error } = await supabase
    .from("rehearsals")
    .delete()
    .eq("id", rehearsalId)
    .select("id");

  if (error) throw error;
  if (!data || data.length === 0) throw new PermissionError("rehearsals.delete");
}

/**
 * Mark a rehearsal as completed
 */
export async function markRehearsalCompleted(rehearsalId: string): Promise<Rehearsal> {
  return updateRehearsal(rehearsalId, { status: "completed" });
}

/**
 * Mark a rehearsal as cancelled
 */
export async function markRehearsalCancelled(rehearsalId: string): Promise<Rehearsal> {
  return updateRehearsal(rehearsalId, { status: "cancelled" });
}

/**
 * Get rehearsals count by status for a band
 */
export async function getRehearsalsStats(bandId: number): Promise<{ scheduled: number; completed: number; cancelled: number }> {
  const { data, error } = await supabase
    .from("rehearsals")
    .select("status")
    .eq("band_id", bandId);

  if (error) throw error;

  const stats = { scheduled: 0, completed: 0, cancelled: 0 };
  (data || []).forEach((rehearsal) => {
    if (rehearsal.status in stats) {
      stats[rehearsal.status as RehearsalStatus]++;
    }
  });

  return stats;
}
