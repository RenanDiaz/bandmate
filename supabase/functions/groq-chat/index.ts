import { createClient } from "npm:@supabase/supabase-js@2";
import { groqUpstreamError, parseGroqChatRequest } from "../_shared/groqProxy.ts";

/**
 * Chat completions for the AI setlist features, with the Groq key kept
 * server-side (secret `GROQ_API_KEY`; it used to ship in the bundle as
 * `VITE_GROQ_API_KEY`). Called by `groqService.chat` with the user's JWT
 * (default `verify_jwt`); a signed-in user is required, since the anon key
 * alone also passes `verify_jwt`.
 *
 * Body: `{ messages: { role, content }[], model?, temperature?, maxTokens?, topP? }`
 * — validated by `parseGroqChatRequest` (allowed models, size caps).
 * Answer: `{ content: string }`.
 * Errors: `{ error: <code> }` with 400 invalid-request, 401
 * not-authenticated, 413 too-large, 429 rate-limited, 500 not-configured,
 * 502 upstream-auth / upstream-error. Errors from Groq add
 * `upstreamStatus` (Groq's HTTP status).
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "invalid-request" }, 405);

  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) {
    console.error("groq-chat: GROQ_API_KEY is not set");
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
  const parsed = parseGroqChatRequest(body);
  if (!parsed.ok) return json({ error: parsed.error }, parsed.error === "too-large" ? 413 : 400);

  let response: Response;
  try {
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(parsed.request),
    });
  } catch (err) {
    console.error("groq-chat: request failed", err);
    return json({ error: "upstream-error" }, 502);
  }

  if (!response.ok) {
    console.error("groq-chat: Groq answered", response.status, await response.text());
    const mapped = groqUpstreamError(response.status);
    // Groq's status (not its body) helps tell a bad model from a bad key.
    return json({ error: mapped.error, upstreamStatus: response.status }, mapped.status);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  return json({ content: typeof content === "string" ? content : "" });
});
