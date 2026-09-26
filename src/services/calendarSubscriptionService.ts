import { supabase } from "../lib/supabaseClient";
import { getSessionUser } from "../lib/authSession";

export interface CalendarSubscription {
  id: string;
  band_id: number;
  user_id: string;
  token: string;
  is_active: boolean;
  include_shows: boolean;
  include_rehearsals: boolean;
  timezone: string | null;
  created_at: string;
  updated_at: string;
}

export type CalendarSubscriptionOptions = Partial<
  Pick<CalendarSubscription, "include_shows" | "include_rehearsals" | "timezone">
>;

/** The browser's IANA time zone ("America/Panama"), or null if unknown. */
export function getDeviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/**
 * Get the current user's calendar subscription for a band.
 * Resolves `null` when there is none; throws when the lookup itself fails, so
 * a network error isn't mistaken for "no subscription".
 */
export async function getCalendarSubscription(
  bandId: number
): Promise<CalendarSubscription | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("calendar_subscriptions")
    .select("*")
    .eq("band_id", bandId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load subscription: ${error.message}`);
  return data;
}

/**
 * Create or re-activate a calendar subscription for the current user/band.
 * Uses upsert to handle the unique constraint on (band_id, user_id); an
 * existing row keeps its token, so URLs already in use keep working.
 */
export async function createCalendarSubscription(
  bandId: number
): Promise<CalendarSubscription> {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("calendar_subscriptions")
    .upsert(
      {
        band_id: bandId,
        user_id: user.id,
        is_active: true,
        timezone: getDeviceTimeZone(),
      },
      { onConflict: "band_id,user_id" }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to create subscription: ${error.message}`);
  return data;
}

/**
 * Change what the feed includes (shows, rehearsals) or its time zone.
 * Takes effect on the calendar app's next refresh; the URL doesn't change.
 */
export async function updateCalendarSubscriptionOptions(
  subscriptionId: string,
  options: CalendarSubscriptionOptions
): Promise<CalendarSubscription> {
  const { data, error } = await supabase
    .from("calendar_subscriptions")
    .update(options)
    .eq("id", subscriptionId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update subscription: ${error.message}`);
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

/**
 * One-tap subscribe links. `webcal://` opens the system calendar on iOS and
 * macOS (Apple Calendar, also Outlook desktop); Google and Outlook.com take
 * the feed URL as a parameter. Android has no webcal handler: use Google.
 */
export function getCalendarSubscribeLinks(feedUrl: string, calendarName: string) {
  const webcal = feedUrl.replace(/^https?:\/\//, "webcal://");
  return {
    apple: webcal,
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(
      webcal
    )}`,
    outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(
      feedUrl
    )}&name=${encodeURIComponent(calendarName)}`,
  };
}
