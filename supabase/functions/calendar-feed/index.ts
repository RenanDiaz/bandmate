import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  addDays,
  buildIcsCalendar,
  rehearsalToIcsEvent,
  showToIcsEvent,
} from "../_shared/ics.ts";
import type { IcsEvent } from "../_shared/ics.ts";

/**
 * Public iCal feed of a band's shows and rehearsals, one per subscriber
 * (`calendar_subscriptions.token`). Calendar apps fetch it without any auth
 * header, so deploy it with `--no-verify-jwt`.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Older events are left out to keep the feed small; calendar apps keep the
// copies they already have.
const PAST_DAYS = 365;

function textResponse(body: string, status: number): Response {
  return new Response(body, { status, headers: corsHeaders });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // Some clients append ".ics" to make the URL look like a file.
    const token = url.searchParams.get("token")?.replace(/\.ics$/i, "");

    if (!token) return textResponse("Missing token parameter", 400);
    // `token` is a UUID column: anything else would make Postgres error out.
    if (!isUuid(token)) return textResponse("Invalid subscription token", 404);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const appUrl = (Deno.env.get("APP_URL") ?? "https://www.bandmate.space")
      .replace(/\/$/, "");

    const { data: subscription, error: subError } = await supabase
      .from("calendar_subscriptions")
      .select("*, bands(name)")
      .eq("token", token)
      .maybeSingle();

    if (subError) throw new Error(subError.message);
    if (!subscription) {
      return textResponse("Invalid or expired subscription token", 404);
    }
    if (!subscription.is_active) {
      return textResponse("Subscription is inactive", 403);
    }

    // The feed runs with the service role (no RLS), so check here that the
    // subscriber still belongs to the band: a removed member's URL stops working.
    const { data: membership, error: memberError } = await supabase
      .from("band_members")
      .select("user_id")
      .eq("band_id", subscription.band_id)
      .eq("user_id", subscription.user_id)
      .maybeSingle();

    if (memberError) throw new Error(memberError.message);
    if (!membership) return textResponse("Subscription is inactive", 403);

    const since = addDays(new Date().toISOString().slice(0, 10), -PAST_DAYS);

    const [showsResult, rehearsalsResult] = await Promise.all([
      subscription.include_shows === false
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from("shows")
            .select("*")
            .eq("band_id", subscription.band_id)
            .gte("event_date", since)
            .order("event_date", { ascending: true }),
      subscription.include_rehearsals === false
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from("rehearsals")
            .select("*")
            .eq("band_id", subscription.band_id)
            .gte("rehearsal_date", since)
            .order("rehearsal_date", { ascending: true }),
    ]);

    if (showsResult.error) {
      throw new Error(`Failed to fetch shows: ${showsResult.error.message}`);
    }
    if (rehearsalsResult.error) {
      throw new Error(
        `Failed to fetch rehearsals: ${rehearsalsResult.error.message}`
      );
    }

    const events: IcsEvent[] = [
      ...(showsResult.data ?? []).map((show) =>
        showToIcsEvent(show, undefined, appUrl)
      ),
      ...(rehearsalsResult.data ?? []).map((rehearsal) =>
        rehearsalToIcsEvent(rehearsal, undefined, appUrl)
      ),
    ];

    const bandName =
      (subscription.bands as { name: string } | null)?.name ?? "Bandmate";

    const ics = buildIcsCalendar({
      prodId: "-//Bandmate//Band Calendar//EN",
      name: `${bandName} (Bandmate)`,
      description: `Shows and rehearsals for ${bandName}`,
      timezone: subscription.timezone,
      refreshHours: 6,
      events,
    });

    return new Response(req.method === "HEAD" ? null : ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        // ASCII only: header values can't carry a band name like "Canción".
        "Content-Disposition": 'inline; filename="bandmate.ics"',
        "Cache-Control": "no-cache, no-store, must-revalidate",
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error("calendar-feed failed:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }
});
