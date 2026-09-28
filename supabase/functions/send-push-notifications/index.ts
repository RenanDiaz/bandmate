import { createClient } from "npm:@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.5.0";
import {
  actorDisplayName,
  buildPushMessage,
  normalizePushLocale,
} from "../_shared/pushMessages.ts";
import type { PushEventType, PushLocale, PushMessage } from "../_shared/pushMessages.ts";
import {
  isSubscriptionGone,
  secretsMatch,
  selectRecipients,
} from "../_shared/pushRecipients.ts";

/**
 * Sends the Web Push notifications of one `notification_events` row
 * (docs/specs/band-push-notifications.md §3.2). Called only by the
 * `dispatch_notification_event` trigger through pg_net, with the shared
 * secret from Vault in `x-push-secret`; there is no user JWT, so deploy it
 * with `--no-verify-jwt`. The body carries only the event id: everything
 * sent is re-read here with the service role.
 *
 * Secrets: PUSH_SECRET (same value as Vault's push_function_secret),
 * VAPID_KEYS (JSON from `npm run vapid-keys`), VAPID_SUBJECT (mailto: or
 * https: contact, required by Apple's push service).
 */

const SEND_CONCURRENCY = 10;
// A notification about a new or moved show is stale after a day.
const TTL_SECONDS = 24 * 60 * 60;

type EventRow = {
  id: number;
  band_id: number;
  actor_id: string;
  type: PushEventType;
  entity_id: string;
  payload: Record<string, unknown>;
};

type SubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  locale: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let vapidKeysPromise: Promise<CryptoKeyPair> | null = null;

function vapidKeys(): Promise<CryptoKeyPair> {
  if (!vapidKeysPromise) {
    const raw = Deno.env.get("VAPID_KEYS");
    if (!raw) throw new Error("VAPID_KEYS is not set");
    vapidKeysPromise = webpush.importVapidKeys(JSON.parse(raw), { extractable: false });
    vapidKeysPromise.catch(() => {
      vapidKeysPromise = null;
    });
  }
  return vapidKeysPromise;
}

async function runPool<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await task(item);
    }
  });
  await Promise.all(workers);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const expected = Deno.env.get("PUSH_SECRET") ?? "";
  if (!secretsMatch(req.headers.get("x-push-secret"), expected)) {
    return json({ error: "unauthorized" }, 401);
  }

  let eventId: number;
  try {
    const body = await req.json();
    eventId = Number(body?.eventId);
  } catch {
    return json({ error: "invalid body" }, 400);
  }
  if (!Number.isSafeInteger(eventId) || eventId <= 0) {
    return json({ error: "invalid eventId" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Claim the event: only the first call for an id gets the row back, so a
  // replay (or the cron's re-post of a lost call) sends nothing twice. A
  // change still inside its coalescing window (send_after ahead) isn't
  // claimed: later edits may rewrite or delete it.
  const now = new Date().toISOString();
  const { data: event, error: claimError } = await supabase
    .from("notification_events")
    .update({ processed_at: now })
    .eq("id", eventId)
    .is("processed_at", null)
    .or(`send_after.is.null,send_after.lte.${now}`)
    .select("id, band_id, actor_id, type, entity_id, payload")
    .maybeSingle<EventRow>();

  if (claimError) {
    console.error("[push] claim failed", eventId, claimError.message);
    return json({ error: "claim failed" }, 500);
  }
  if (!event) {
    const { data: waiting } = await supabase
      .from("notification_events")
      .select("id")
      .eq("id", eventId)
      .is("processed_at", null)
      .gt("send_after", now)
      .maybeSingle();
    return json(waiting ? { deferred: true } : { skipped: true });
  }

  const finish = async (recipients: number, error: string | null) => {
    const { error: updateError } = await supabase
      .from("notification_events")
      .update({ recipients, error })
      .eq("id", event.id);
    if (updateError) console.error("[push] result not saved", event.id, updateError.message);
  };

  try {
    const [bandResult, membersResult, mutesResult, actorResult] = await Promise.all([
      supabase.from("bands").select("name").eq("id", event.band_id).maybeSingle(),
      supabase.from("band_members").select("user_id, expires_at").eq("band_id", event.band_id),
      supabase.from("band_notification_mutes").select("user_id").eq("band_id", event.band_id),
      supabase.auth.admin.getUserById(event.actor_id),
    ]);
    if (bandResult.error) throw new Error(`band: ${bandResult.error.message}`);
    if (membersResult.error) throw new Error(`members: ${membersResult.error.message}`);
    if (mutesResult.error) throw new Error(`mutes: ${mutesResult.error.message}`);
    // A missing actor (deleted account) only loses the name.
    const actorUser = actorResult.data?.user ?? null;

    if (!bandResult.data) {
      await finish(0, "band not found");
      return json({ sent: 0 });
    }

    const recipientIds = selectRecipients(
      membersResult.data ?? [],
      (mutesResult.data ?? []).map((row) => row.user_id),
      event.actor_id,
      new Date()
    );
    if (recipientIds.length === 0) {
      await finish(0, null);
      return json({ sent: 0 });
    }

    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth, locale")
      .in("user_id", recipientIds)
      .returns<SubscriptionRow[]>();
    if (subError) throw new Error(`subscriptions: ${subError.message}`);
    if (!subscriptions || subscriptions.length === 0) {
      await finish(0, null);
      return json({ sent: 0 });
    }

    const bandName: string = bandResult.data.name ?? "";
    const actorName =
      actorDisplayName(actorUser?.user_metadata ?? null, actorUser?.email ?? null) ?? "";
    const messages = new Map<PushLocale, string>();
    const messageFor = (locale: PushLocale): string => {
      let message = messages.get(locale);
      if (!message) {
        const built: PushMessage = buildPushMessage({
          type: event.type,
          bandId: event.band_id,
          bandName,
          actorName,
          entityId: event.entity_id,
          payload: event.payload ?? {},
          locale,
        });
        message = JSON.stringify(built);
        messages.set(locale, message);
      }
      return message;
    };

    const keys = await vapidKeys();
    const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@bandmate.space";
    const delivered: string[] = [];
    const gone: string[] = [];
    const failures: string[] = [];

    await runPool(subscriptions, SEND_CONCURRENCY, async (sub) => {
      try {
        // A fresh ECDH key pair per message (RFC 8291 §3.1): the library keeps
        // one per ApplicationServer, so create one for each send.
        const server = await webpush.ApplicationServer.new({
          contactInformation: subject,
          vapidKeys: keys,
        });
        await server
          .subscribe({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } })
          .pushTextMessage(messageFor(normalizePushLocale(sub.locale)), {
            ttl: TTL_SECONDS,
            urgency: webpush.Urgency.Normal,
          });
        delivered.push(sub.id);
      } catch (error) {
        if (error instanceof webpush.PushMessageError && isSubscriptionGone(error.response.status)) {
          gone.push(sub.id);
        } else {
          const reason =
            error instanceof webpush.PushMessageError
              ? `${error.response.status} ${new URL(sub.endpoint).host}`
              : error instanceof Error
                ? error.message
                : String(error);
          failures.push(reason);
        }
      }
    });

    const sentAt = new Date().toISOString();
    const followUps = [];
    if (delivered.length > 0) {
      followUps.push(
        supabase.from("push_subscriptions").update({ last_success_at: sentAt }).in("id", delivered)
      );
    }
    if (gone.length > 0) {
      followUps.push(supabase.from("push_subscriptions").delete().in("id", gone));
    }
    for (const result of await Promise.all(followUps)) {
      if (result.error) console.error("[push] subscription update failed", result.error.message);
    }

    const error = failures.length > 0 ? `failed: ${failures.slice(0, 5).join("; ")}` : null;
    await finish(delivered.length, error);
    console.info(
      `[push] event ${event.id} ${event.type}: sent ${delivered.length}, gone ${gone.length}, failed ${failures.length}`
    );
    return json({ sent: delivered.length, gone: gone.length, failed: failures.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[push] event failed", event.id, message);
    await finish(0, message.slice(0, 500));
    return json({ error: "send failed" }, 500);
  }
});
