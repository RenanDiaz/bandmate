import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildSignInHelpEmail,
  checkSignInHelpQuota,
  normalizeSignInHelpLocale,
  signInMethods,
} from "../_shared/signInHelp.ts";
import { actorDisplayName } from "../_shared/pushMessages.ts";

/**
 * Emails a band member how to sign in to Bandmate (which account, which
 * button, the link) — docs/specs/member-sign-in-help.md. Called from the
 * band's member list by the owner, with the user's JWT (default
 * `verify_jwt`). Runs with the service role, so every input is re-checked:
 *
 * - the caller is the band's owner (`band_members.role = 'owner'`);
 * - the recipient is a member of that band and is not the caller;
 * - per recipient (any band): one email per 10 min, three per 24 h
 *   (`member_sign_in_help_emails`).
 *
 * The recipient's email and sign-in methods come from `auth.users` here and
 * never reach the client. Secrets: RESEND_API_KEY, APP_URL (same as
 * `send-invitation-email`).
 *
 * Body: `{ bandId: number, memberUserId: string, locale?: "en" | "es" }`.
 * Errors: `{ error: <code> }` with 400 invalid-request, 401
 * not-authenticated, 403 forbidden, 404 member-not-found, 422 no-email,
 * 429 too-soon (+ `retryAfterSeconds`), 500 not-configured, 502 send-failed.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "invalid-request" }, 405);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const appUrl = Deno.env.get("APP_URL");
  if (!resendKey || !appUrl) {
    console.error("send-sign-in-help: RESEND_API_KEY or APP_URL is not set");
    return json({ error: "not-configured" }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid-request" }, 400);
  }
  const bandId = body.bandId;
  const memberUserId = body.memberUserId;
  if (
    typeof bandId !== "number" ||
    !Number.isSafeInteger(bandId) ||
    typeof memberUserId !== "string" ||
    !UUID_RE.test(memberUserId)
  ) {
    return json({ error: "invalid-request" }, 400);
  }
  const locale = normalizeSignInHelpLocale(body.locale);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Who is calling: the JWT in Authorization, checked against the auth server.
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: callerData, error: callerError } = jwt
    ? await admin.auth.getUser(jwt)
    : { data: { user: null }, error: null };
  const caller = callerData?.user;
  if (callerError || !caller) return json({ error: "not-authenticated" }, 401);

  if (caller.id === memberUserId) return json({ error: "forbidden" }, 403);

  // band_members has no RLS: this check is the only gate.
  const { data: rows, error: membersError } = await admin
    .from("band_members")
    .select("user_id, role")
    .eq("band_id", bandId)
    .in("user_id", [caller.id, memberUserId]);
  if (membersError) {
    console.error("send-sign-in-help: band_members read failed", membersError);
    return json({ error: "send-failed" }, 502);
  }
  const callerRow = rows?.find((row) => row.user_id === caller.id);
  const memberRow = rows?.find((row) => row.user_id === memberUserId);
  if (callerRow?.role !== "owner") return json({ error: "forbidden" }, 403);
  if (!memberRow) return json({ error: "member-not-found" }, 404);

  const { data: recipientData, error: recipientError } =
    await admin.auth.admin.getUserById(memberUserId);
  const recipient = recipientData?.user;
  if (recipientError || !recipient) return json({ error: "member-not-found" }, 404);
  if (!recipient.email) return json({ error: "no-email" }, 422);

  // Quota per recipient, across bands: protects their inbox from several owners.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recent, error: recentError } = await admin
    .from("member_sign_in_help_emails")
    .select("sent_at")
    .eq("recipient_id", memberUserId)
    .gte("sent_at", since);
  if (recentError) {
    console.error("send-sign-in-help: quota read failed", recentError);
    return json({ error: "send-failed" }, 502);
  }
  const quota = checkSignInHelpQuota(
    (recent ?? []).map((row) => row.sent_at as string),
    Date.now(),
  );
  if (!quota.ok) {
    return json({ error: "too-soon", retryAfterSeconds: quota.retryAfterSeconds }, 429);
  }

  const { data: band } = await admin.from("bands").select("name").eq("id", bandId).single();

  // Same rule as push notifications: a name, else the email's local part.
  const senderName = actorDisplayName(caller.user_metadata, caller.email) ?? "";

  const email = buildSignInHelpEmail({
    locale,
    bandName: (band?.name as string | undefined) ?? "",
    senderName,
    recipientEmail: recipient.email,
    methods: signInMethods(recipient.app_metadata),
    appUrl,
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: "Bandmate <invitations@bandmate.space>",
      to: [recipient.email],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });
  if (!res.ok) {
    console.error("send-sign-in-help: Resend refused", res.status, await res.text());
    return json({ error: "send-failed" }, 502);
  }

  const { error: logError } = await admin.from("member_sign_in_help_emails").insert({
    band_id: bandId,
    recipient_id: memberUserId,
    sent_by: caller.id,
  });
  // The email went out: report success, but leave a trace (the quota missed one).
  if (logError) console.error("send-sign-in-help: log insert failed", logError);

  return json({ sent: true });
});
