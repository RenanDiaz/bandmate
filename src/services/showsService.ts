import { supabase } from "../lib/supabaseClient";
import { canUserManageEvents } from "./bandMembersService";
import { getLocalToday } from "../lib/dateUtils";
import { PermissionError } from "./permissionError";

export type ShowStatus = "upcoming" | "completed" | "cancelled";

export interface Show {
  id: string;
  band_id: number;
  user_id: string;
  setlist_id?: string | null;
  name: string;
  venue?: string;
  venue_address?: string;
  event_date: string;
  event_time?: string;
  doors_time?: string;
  soundcheck_time?: string;
  status: ShowStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateShowInput {
  band_id: number;
  name: string;
  venue?: string;
  venue_address?: string;
  event_date: string;
  event_time?: string;
  doors_time?: string;
  soundcheck_time?: string;
  setlist_id?: string;
  status?: ShowStatus;
  notes?: string;
}

export interface UpdateShowInput {
  name?: string;
  venue?: string;
  venue_address?: string;
  event_date?: string;
  event_time?: string;
  doors_time?: string;
  soundcheck_time?: string;
  setlist_id?: string | null;
  status?: ShowStatus;
  notes?: string;
}

/**
 * Get all shows for a band
 */
export async function getBandShows(bandId: number): Promise<Show[]> {
  const { data, error } = await supabase
    .from("shows")
    .select("*")
    .eq("band_id", bandId)
    .order("event_date", { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get upcoming shows for a band
 */
export async function getUpcomingShows(bandId: number): Promise<Show[]> {
  const today = getLocalToday();

  const { data, error } = await supabase
    .from("shows")
    .select("*")
    .eq("band_id", bandId)
    .eq("status", "upcoming")
    .gte("event_date", today)
    .order("event_date", { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get past shows for a band
 */
export async function getPastShows(bandId: number): Promise<Show[]> {
  const today = getLocalToday();

  const { data, error } = await supabase
    .from("shows")
    .select("*")
    .eq("band_id", bandId)
    .or(`status.eq.completed,event_date.lt.${today}`)
    .order("event_date", { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get a single show by ID
 */
export async function getShow(showId: string): Promise<Show> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("shows")
    .select("*")
    .eq("id", showId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create a new show
 */
export async function createShow(show: CreateShowInput): Promise<Show> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("shows")
    .insert([
      {
        ...show,
        user_id: user.id,
        status: show.status || "upcoming",
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update an existing show
 */
export async function updateShow(showId: string, updates: UpdateShowInput): Promise<Show> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  // First get the show to check band membership
  const { data: show, error: fetchError } = await supabase
    .from("shows")
    .select("band_id")
    .eq("id", showId)
    .single();

  if (fetchError) throw fetchError;
  if (!show) throw new Error("Show not found");

  // Check if user has permission to manage events in this band
  const hasPermission = await canUserManageEvents(show.band_id);
  if (!hasPermission) {
    throw new PermissionError("shows.update");
  }

  const { data, error } = await supabase
    .from("shows")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", showId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a show
 */
export async function deleteShow(showId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  // First get the show to check band membership
  const { data: show, error: fetchError } = await supabase
    .from("shows")
    .select("band_id")
    .eq("id", showId)
    .single();

  if (fetchError) throw fetchError;
  if (!show) throw new Error("Show not found");

  // Check if user has permission to manage events in this band
  const hasPermission = await canUserManageEvents(show.band_id);
  if (!hasPermission) {
    throw new PermissionError("shows.delete");
  }

  // Ask for the deleted id: RLS filters a refused row out and PostgREST still
  // answers 200, so an empty result is the only sign the delete was refused.
  const { data, error } = await supabase
    .from("shows")
    .delete()
    .eq("id", showId)
    .select("id");

  if (error) throw error;
  if (!data || data.length === 0) throw new PermissionError("shows.delete");
}

/**
 * Mark a show as completed
 */
export async function markShowCompleted(showId: string): Promise<Show> {
  return updateShow(showId, { status: "completed" });
}

/**
 * Mark a show as cancelled
 */
export async function markShowCancelled(showId: string): Promise<Show> {
  return updateShow(showId, { status: "cancelled" });
}

/**
 * Get shows count by status for a band
 */
export async function getShowsStats(bandId: number): Promise<{ upcoming: number; completed: number; cancelled: number }> {
  const { data, error } = await supabase
    .from("shows")
    .select("status")
    .eq("band_id", bandId);

  if (error) throw error;

  const stats = { upcoming: 0, completed: 0, cancelled: 0 };
  (data || []).forEach((show) => {
    if (show.status in stats) {
      stats[show.status as ShowStatus]++;
    }
  });

  return stats;
}

/**
 * Get shows that use a specific setlist
 */
export async function getShowsBySetlistId(setlistId: string): Promise<Show[]> {
  const { data, error } = await supabase
    .from("shows")
    .select("*")
    .eq("setlist_id", setlistId)
    .order("event_date", { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get upcoming shows for a band that don't have a setlist linked
 */
export async function getUpcomingShowsWithoutSetlist(bandId: number): Promise<Show[]> {
  const today = getLocalToday();

  const { data, error } = await supabase
    .from("shows")
    .select("*")
    .eq("band_id", bandId)
    .eq("status", "upcoming")
    .gte("event_date", today)
    .is("setlist_id", null)
    .order("event_date", { ascending: true });

  if (error) throw error;
  return data || [];
}
