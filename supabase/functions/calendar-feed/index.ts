import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function formatICSDate(dateStr: string, timeStr?: string): string {
  const [year, month, day] = dateStr.split("-");
  if (timeStr) {
    const [hours, minutes] = timeStr.split(":");
    return `${year}${month}${day}T${hours}${minutes}00`;
  }
  return `${year}${month}${day}`;
}

function formatICSTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(
    now.getUTCDate()
  )}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(
    now.getUTCSeconds()
  )}Z`;
}

interface Show {
  id: string;
  name: string;
  venue?: string;
  venue_address?: string;
  event_date: string;
  event_time?: string;
  doors_time?: string;
  soundcheck_time?: string;
  status: string;
  notes?: string;
}

function generateVEvent(show: Show, stamp: string): string {
  const lines: string[] = [
    "BEGIN:VEVENT",
    `UID:show-${show.id}@bandmate`,
    `DTSTAMP:${stamp}`,
    `SUMMARY:${escapeICSText(show.name)}`,
  ];

  if (show.event_time) {
    const dtStart = formatICSDate(show.event_date, show.event_time);
    lines.push(`DTSTART:${dtStart}`);
    // Default 2-hour duration
    const [h, m] = show.event_time.split(":").map(Number);
    const endH = h + 2;
    const endTime = `${endH.toString().padStart(2, "0")}:${m
      .toString()
      .padStart(2, "0")}`;
    lines.push(`DTEND:${formatICSDate(show.event_date, endTime)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${formatICSDate(show.event_date)}`);
    // All-day: end = next day
    const d = new Date(show.event_date + "T00:00:00");
    d.setDate(d.getDate() + 1);
    const pad = (n: number) => n.toString().padStart(2, "0");
    lines.push(
      `DTEND;VALUE=DATE:${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(
        d.getDate()
      )}`
    );
  }

  const location = [show.venue, show.venue_address].filter(Boolean).join(", ");
  if (location) {
    lines.push(`LOCATION:${escapeICSText(location)}`);
  }

  const descParts: string[] = [];
  if (show.soundcheck_time) {
    descParts.push(`Soundcheck: ${show.soundcheck_time}`);
  }
  if (show.doors_time) {
    descParts.push(`Doors: ${show.doors_time}`);
  }
  if (show.notes) {
    descParts.push(show.notes);
  }
  if (descParts.length > 0) {
    lines.push(`DESCRIPTION:${escapeICSText(descParts.join("\n"))}`);
  }

  lines.push(
    `STATUS:${show.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`
  );
  lines.push("END:VEVENT");

  return lines.join("\r\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response("Missing token parameter", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Look up subscription by token
    const { data: subscription, error: subError } = await supabase
      .from("calendar_subscriptions")
      .select("band_id, is_active, bands(name)")
      .eq("token", token)
      .single();

    if (subError || !subscription) {
      return new Response("Invalid or expired subscription token", {
        status: 404,
        headers: corsHeaders,
      });
    }

    if (!subscription.is_active) {
      return new Response("Subscription is inactive", {
        status: 403,
        headers: corsHeaders,
      });
    }

    // Fetch all shows for this band
    const { data: shows, error: showsError } = await supabase
      .from("shows")
      .select("*")
      .eq("band_id", subscription.band_id)
      .order("event_date", { ascending: true });

    if (showsError) {
      throw new Error(`Failed to fetch shows: ${showsError.message}`);
    }

    const bandName =
      (subscription.bands as { name: string } | null)?.name ?? "Bandmate";
    const stamp = formatICSTimestamp();

    const icsLines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Bandmate//Shows Calendar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${escapeICSText(bandName)} - Shows`,
      `X-WR-CALDESC:${escapeICSText(`Shows and gigs for ${bandName}`)}`,
      // Suggest 12-hour refresh interval
      "X-PUBLISHED-TTL:PT12H",
      "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    ];

    for (const show of shows || []) {
      icsLines.push(generateVEvent(show, stamp));
    }

    icsLines.push("END:VCALENDAR");

    const icsContent = icsLines.join("\r\n");

    return new Response(icsContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${bandName}-shows.ics"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        ...corsHeaders,
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }
});
