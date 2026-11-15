import { createClient } from "npm:@supabase/supabase-js@2";
import {
  parseSpotifyLookup,
  spotifySearchPath,
  trackToMetadata,
  type SpotifyTrack,
} from "../_shared/spotifyMetadata.ts";

/**
 * Song metadata from the Spotify Web API (Client Credentials), with the
 * client secret kept server-side (secrets `SPOTIFY_CLIENT_ID`,
 * `SPOTIFY_CLIENT_SECRET`; they used to ship in the bundle as
 * `VITE_SPOTIFY_CLIENT_*`). Called by `spotifyService.getSongMetadata` with
 * the user's JWT (default `verify_jwt`); a signed-in user is required.
 *
 * Body: `{ title: string, artist?: string }`.
 * Answer: `{ metadata: SpotifySongMetadata | null }` (null: no match).
 * Errors: `{ error: <code> }` with 400 invalid-request, 401
 * not-authenticated, 429 rate-limited, 500 not-configured, 502
 * upstream-error (+ `stage`: token | search and `upstreamStatus`, Spotify's
 * HTTP status).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/** Cached for the life of the worker; refreshed a minute before it expires. */
let token: { value: string; expiresAt: number } | null = null;

class SpotifyError extends Error {
  constructor(readonly stage: "token" | "search", readonly upstreamStatus: number) {
    super(`${stage} request failed: ${upstreamStatus}`);
  }
}

async function accessToken(clientId: string, clientSecret: string): Promise<string> {
  if (token && token.expiresAt > Date.now()) return token.value;
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) {
    console.error("spotify-metadata: token request failed", response.status, await response.text());
    throw new SpotifyError("token", response.status);
  }
  const data = await response.json();
  token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 - 60_000 };
  return token.value;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "invalid-request" }, 405);

  const clientId = Deno.env.get("SPOTIFY_CLIENT_ID");
  const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    console.error("spotify-metadata: SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET is not set");
    return json({ error: "not-configured" }, 500);
  }

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const auth = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = jwt
    ? await auth.auth.getUser(jwt)
    : { data: { user: null }, error: null };
  if (userError || !userData?.user) return json({ error: "not-authenticated" }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid-request" }, 400);
  }
  const lookup = parseSpotifyLookup(body);
  if (!lookup) return json({ error: "invalid-request" }, 400);

  try {
    const response = await fetch(`https://api.spotify.com/v1${spotifySearchPath(lookup)}`, {
      headers: { Authorization: `Bearer ${await accessToken(clientId, clientSecret)}` },
    });
    if (response.status === 429) return json({ error: "rate-limited" }, 429);
    if (!response.ok) {
      console.error("spotify-metadata: Spotify answered", response.status, await response.text());
      if (response.status === 401) token = null;
      return json({ error: "upstream-error", stage: "search", upstreamStatus: response.status }, 502);
    }
    const data = await response.json();
    const track: SpotifyTrack | undefined = data?.tracks?.items?.[0];
    return json({ metadata: track ? trackToMetadata(track) : null });
  } catch (err) {
    if (err instanceof SpotifyError) {
      return json({ error: "upstream-error", stage: err.stage, upstreamStatus: err.upstreamStatus }, 502);
    }
    console.error("spotify-metadata: request failed", err);
    return json({ error: "upstream-error" }, 502);
  }
});
