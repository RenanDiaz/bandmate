# Setting up push notifications

Band push notifications (spec:
[docs/specs/band-push-notifications.md](../specs/band-push-notifications.md))
need steps 1–3 once per Supabase project and step 4 on the app's build;
Phase 2 (moved / cancelled) adds step 6 (`pg_cron`). Until
they are done, the database still records `notification_events` and nothing is
sent: the app and every write keep working.

```
shows / rehearsals / setlists INSERT
  └─ trigger → notification_events (outbox)
       └─ trigger → pg_net POST { eventId } + x-push-secret   (URL + secret from Vault)
            └─ Edge Function send-push-notifications
                 └─ Web Push (VAPID) → each member's browser
```

## 1. VAPID keys

```bash
npm run vapid-keys
```

It prints two lines (nothing is written to disk):

- `supabase secrets set VAPID_KEYS='…'` — the key pair (JWK JSON). **Private**:
  only in Edge Function secrets, never in a `VITE_*` variable or the repo.
- `VITE_VAPID_PUBLIC_KEY=…` — the public key the browser subscribes with. Public
  by design; it goes into `.env` and the Vercel project (used from PR 1.2).

Generate them **once**. New keys invalidate every existing subscription (each
device has to turn notifications on again).

## 2. Edge Function secrets and deploy

```bash
# The shared secret between the database and the function (any long random string)
PUSH_SECRET=$(openssl rand -hex 32)

supabase secrets set VAPID_KEYS='<from step 1>'
supabase secrets set VAPID_SUBJECT='mailto:<a contact address>'   # Apple's push service requires it
supabase secrets set PUSH_SECRET="$PUSH_SECRET"

supabase functions deploy send-push-notifications --no-verify-jwt
```

`--no-verify-jwt` (also in `supabase/config.toml`): pg_net sends no user JWT.
The function rejects every request without the matching `x-push-secret`
(401) and only accepts an event id, which it re-reads with the service role.

## 3. Database: pg_net and Vault

Apply the migration (`supabase db push`,
`20260927180000_push_notifications.sql`). It enables `pg_net` when it can; if
it printed "pg_net not available", enable it under Database → Extensions.

Then store the function URL and the same shared secret in Vault (SQL editor):

```sql
select vault.create_secret(
  'https://<project-ref>.supabase.co/functions/v1/send-push-notifications',
  'push_function_url'
);
select vault.create_secret('<the PUSH_SECRET value>', 'push_function_secret');
```

To change one later: `select vault.update_secret(id, '<new value>') from
vault.secrets where name = 'push_function_secret';` — and `supabase secrets
set PUSH_SECRET=…` with the same value.

## 4. The app

Set on the Vercel project (and in `.env` locally), then redeploy:

| Variable | Value |
|----------|-------|
| `VITE_VAPID_PUBLIC_KEY` | the public key from step 1 (must match `VAPID_KEYS`) |
| `VITE_PUSH_NOTIFICATIONS` | `true` to show the settings to everyone; leave it unset and use `localStorage.bandmate_flag_push = "1"` per device while testing against production (or open any page with `?flag=push`; `?flag=-push` clears it) |

The Notifications row appears in the user menu (signed in, online). Push
needs the **built** worker: locally, `npm run build && npm run preview`
(the `npm run dev` worker doesn't load `push-sw.js`).

## 5. Check it end to end

1. As member **B**: user menu → Notifications → **Turn on**, allow the prompt.
   On iPhone / iPad do it in the app opened from the Home Screen (in a Safari
   tab the modal says to install first). `push_subscriptions` now has B's row.
2. As member **A** (another browser or account), add a show to a band B
   belongs to. Within seconds B gets "<band> · New show"; tapping it opens the
   show with that band selected.
3. Without the app UI (e.g. debugging the backend alone), subscribe from
   DevTools instead and insert the row by hand:

   ```js
   const reg = await navigator.serviceWorker.ready;
   const sub = await reg.pushManager.subscribe({
     userVisibleOnly: true,
     applicationServerKey: "<VITE_VAPID_PUBLIC_KEY>",
   });
   copy(JSON.stringify(sub)); // endpoint + keys.p256dh + keys.auth
   ```

   ```sql
   insert into push_subscriptions (user_id, endpoint, p256dh, auth, locale)
   values ('<B user id>', '<endpoint>', '<p256dh>', '<auth>', 'es');
   ```

4. Inspect:

   ```sql
   select id, type, send_after, dispatched_at, dispatch_attempts,
          processed_at, recipients, error
   from notification_events order by id desc limit 10;

   select id, status_code, content::text
   from net._http_response order by id desc limit 10;   -- pg_net's answers
   ```

   Function logs: Dashboard → Edge Functions → send-push-notifications → Logs
   (`[push] event … sent N, gone N, failed N`).

## 6. Moved and cancelled (Phase 2): pg_cron

Changes wait two minutes for more edits, then a `pg_cron` job posts them
(the same job re-posts calls the function never received). Once per project:

1. Dashboard → Database → Extensions → enable **pg_cron**.
2. `supabase db push` (migration `20260928120000_push_notifications_changes.sql`
   schedules the job when `pg_cron` is there).
3. `supabase functions deploy send-push-notifications --no-verify-jwt`
   (new texts, and it refuses rows still inside their window).
4. Check:

   ```sql
   select jobid, jobname, schedule, command from cron.job;
   -- one row: dispatch-notification-events, '* * * * *'

   select start_time, status, return_message
   from cron.job_run_details order by start_time desc limit 5;
   ```

If `pg_cron` was enabled **after** the migration ran, schedule the job by hand
(safe to repeat):

```sql
select cron.unschedule(jobid) from cron.job where jobname = 'dispatch-notification-events';
select cron.schedule('dispatch-notification-events', '* * * * *',
  'select public.dispatch_due_notification_events()');
```

End to end: as A, change the date of a future show B can see. Right away
`notification_events` has a `show.moved` row with `send_after` two minutes
ahead and `dispatched_at` null; edit it again and the same row changes (new
`payload.after`, later `send_after`). About a minute after `send_after`,
`dispatched_at` is set, then `processed_at`, and B gets "X · Show moved",
replacing that show's earlier notification.

## What sends a notification

| Write | Event | Notes |
|-------|-------|-------|
| INSERT `shows` | `show.created` | not when the date is in the past or the status is completed / cancelled; sent at once |
| INSERT `rehearsals` | `rehearsal.created` | same rule |
| INSERT `setlists` with `is_draft = false`, or UPDATE `is_draft` true → false | `setlist.published` | drafts send nothing |
| UPDATE `shows` `event_date` / `event_time` / `venue` | `show.moved` | Phase 2: sent 2–3 min after the **last** edit, one per show; moved back → nothing |
| UPDATE `shows` `status` → `cancelled` | `show.cancelled` | replaces a pending `show.moved` |
| UPDATE `rehearsals` `rehearsal_date` / `start_time` / `location`, `status` → `cancelled` | `rehearsal.moved` / `rehearsal.cancelled` | same rules |

Changes never notify for: notes, name, setlist, soundcheck / doors / end
time; status → completed; an event already cancelled (un-cancelling
included); an event whose old and new dates are both more than a day past;
deleting a row. The actor of a coalesced change is its last editor.

The actor is `auth.uid()` of the request. Writes from the SQL editor or the
service role have none and send nothing. Recipients: every band member except
the actor (guests included, expired guests not), minus those who muted the
band (`band_notification_mutes`).

## Troubleshooting

| Symptom | Look at |
|---------|---------|
| `show.moved` / `rehearsal.moved` rows keep `dispatched_at` null after `send_after` | the cron job: `select * from cron.job` (step 6), `cron.job_run_details` for errors; Vault secrets |
| A change row vanished before it was sent | expected: moved back to the original values, or marked completed, inside the window |
| `dispatch_attempts` = 3, `processed_at` null | three posts never reached the function: `net._http_response`, function logs. The cron stops retrying (also after a day) |
| The function answers `{ "deferred": true }` | a call for a row still inside its window; the cron posts it when it's due |
| `notification_events` gets rows, `processed_at` stays null | Vault secrets missing or misspelled; `net._http_response` for 401 (secret mismatch) / 404 (URL) |
| `processed_at` set, `recipients = 0`, no `error` | no other member has a subscription, or they muted the band |
| `error` = `failed: 403 …` | VAPID keys don't match the key the browser subscribed with (keys regenerated?) |
| `error` = `VAPID_KEYS is not set` | step 2 |
| Subscriptions disappear | the push service answered 404/410 (the browser dropped them); expected |
| No Notifications row in the user menu | the flag (step 4), signed in with a live session, online |
| The modal says "can't receive notifications" on iPhone / iPad | it's a Safari tab: open the app from the Home Screen (iOS 16.4+) |
| Turn on fails right away | `VITE_VAPID_PUBLIC_KEY` missing from the build, or `npm run dev` (no push handler in the dev worker) |
| `error` = `failed: 403 web.push.apple.com` (`BadJwtToken`) | Apple's one-hour VAPID limit (spec §6) |
