import { supabase } from "../lib/supabaseClient";

export interface CalendarSubscription {
  id: string;
  band_id: number;
  user_id: string;
  token: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get the current user's calendar subscription for a band
 */
export async function getCalendarSubscription(
  bandId: number
): Promise<CalendarSubscription | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("calendar_subscriptions")
    .select("*")
    .eq("band_id", bandId)
    .eq("user_id", user.id)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Create or re-activate a calendar subscription for the current user/band.
 * Uses upsert to handle the unique constraint on (band_id, user_id).
 */
export async function createCalendarSubscription(
  bandId: number
): Promise<CalendarSubscription> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("calendar_subscriptions")
    .upsert(
      {
        band_id: bandId,
        user_id: user.id,
        is_active: true,
      },
      { onConflict: "band_id,user_id" }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to create subscription: ${error.message}`);
  return data;
}

/**
 * Regenerate the token for an existing subscription (invalidates old URLs)
 */
export async function regenerateSubscriptionToken(
  subscriptionId: string
): Promise<CalendarSubscription> {
  const { data, error } = await supabase
    .from("calendar_subscriptions")
    .update({ token: crypto.randomUUID() })
    .eq("id", subscriptionId)
    .select()
    .single();

  if (error)
    throw new Error(`Failed to regenerate token: ${error.message}`);
  return data;
}

/**
 * Deactivate a calendar subscription
 */
export async function deactivateCalendarSubscription(
  subscriptionId: string
): Promise<void> {
  const { error } = await supabase
    .from("calendar_subscriptions")
    .update({ is_active: false })
    .eq("id", subscriptionId);

  if (error)
    throw new Error(`Failed to deactivate subscription: ${error.message}`);
}

/**
 * Delete a calendar subscription entirely
 */
export async function deleteCalendarSubscription(
  subscriptionId: string
): Promise<void> {
  const { error } = await supabase
    .from("calendar_subscriptions")
    .delete()
    .eq("id", subscriptionId);

  if (error)
    throw new Error(`Failed to delete subscription: ${error.message}`);
}

/**
 * Build the full iCal feed URL for a subscription token
 */
export function getCalendarFeedUrl(token: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/calendar-feed?token=${token}`;
}
