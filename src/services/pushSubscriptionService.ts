import { supabase } from "../lib/supabaseClient";
import { getSessionUser } from "../lib/authSession";

/**
 * Push subscriptions and per-band mutes (docs/specs/band-push-notifications.md
 * §3.1). Browser-side subscribing lives in `src/lib/pushSupport.ts`; this
 * module only talks to the database.
 */

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Store this browser's subscription for the current user. Goes through the
 * `register_push_subscription` RPC (there is no INSERT policy): it upserts on
 * the endpoint and takes it over when another account registered it on this
 * browser before.
 */
export async function savePushSubscription(
  subscription: PushSubscriptionKeys,
  locale: string
): Promise<void> {
  const { error } = await supabase.rpc("register_push_subscription", {
    p_endpoint: subscription.endpoint,
    p_p256dh: subscription.p256dh,
    p_auth: subscription.auth,
    p_locale: locale,
    p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  });
  if (error) throw new Error(error.message);
}

/** Delete this browser's subscription row (RLS: only the caller's own). */
export async function deletePushSubscription(endpoint: string): Promise<void> {
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
  if (error) throw new Error(error.message);
}

/** Whether the current user has a row for this endpoint (it may have been
 * dropped by the sender after a 404/410, or taken over by another account). */
export async function hasPushSubscription(endpoint: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("endpoint", endpoint)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

/** Keep the push language in step with the app's (the row exists already). */
export async function updatePushSubscriptionLocale(
  endpoint: string,
  locale: string
): Promise<void> {
  const { error } = await supabase
    .from("push_subscriptions")
    .update({ locale: locale.toLowerCase().startsWith("es") ? "es" : "en", updated_at: new Date().toISOString() })
    .eq("endpoint", endpoint);
  if (error) throw new Error(error.message);
}

/** Band ids the current user muted. */
export async function getMutedBandIds(): Promise<number[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("band_notification_mutes")
    .select("band_id")
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { band_id: number }) => row.band_id);
}

/** Mute or unmute one band for the current user, on every device. */
export async function setBandMuted(bandId: number, muted: boolean): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in");
  if (muted) {
    const { error } = await supabase
      .from("band_notification_mutes")
      .upsert({ user_id: user.id, band_id: bandId }, { onConflict: "user_id,band_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("band_notification_mutes")
      .delete()
      .eq("user_id", user.id)
      .eq("band_id", bandId);
    if (error) throw new Error(error.message);
  }
}
