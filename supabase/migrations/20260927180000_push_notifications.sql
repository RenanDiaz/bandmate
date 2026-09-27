-- Band push notifications, Phase 1 backend (docs/specs/band-push-notifications.md).
--
-- A trigger on shows / rehearsals / setlists writes one row to
-- notification_events (an outbox) when a member adds one; the outbox INSERT
-- calls the send-push-notifications Edge Function through pg_net. The actor is
-- auth.uid() of the writing request, never the row's user_id (members edit any
-- row, so user_id is only the creator). No auth.uid() (service role, SQL
-- editor) → no event.
--
-- Dispatch reads the function URL and shared secret from Vault
-- (push_function_url, push_function_secret; docs/setup/push-notifications.md).
-- Without them, or without pg_net, events are recorded and nothing is sent.
-- Nothing in here may make the user's write fail: every notification path
-- swallows its own errors.

-- pg_net is enabled on Supabase projects from the dashboard; creating it here
-- keeps `supabase db reset` complete. A database without it keeps working.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_net not available (%): push dispatch is disabled', SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per browser push subscription. The endpoint belongs to the browser:
-- whoever registers it last owns it (register_push_subscription).
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'es')),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_success_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON public.push_subscriptions (user_id);

COMMENT ON TABLE public.push_subscriptions IS
  'Web Push subscriptions, one per browser. locale picks the language of the push text.';

-- A row mutes one band for one user on every device; no row = notifications on.
CREATE TABLE IF NOT EXISTS public.band_notification_mutes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  band_id BIGINT NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, band_id)
);

-- Outbox: written only by the triggers below, read only by the Edge Function
-- (service role). processed_at is set when the function claims the event, so
-- a replayed call sends nothing twice.
CREATE TABLE IF NOT EXISTS public.notification_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  band_id BIGINT NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('show.created', 'rehearsal.created', 'setlist.published')),
  entity_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  recipients INTEGER,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_notification_events_unprocessed
  ON public.notification_events (created_at) WHERE processed_at IS NULL;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_notification_mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can view own push subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can update own push subscriptions"
  ON public.push_subscriptions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete own push subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING (user_id = auth.uid());

-- No INSERT policy: rows are created through register_push_subscription(),
-- which also takes over an endpoint another account registered on this browser.

DROP POLICY IF EXISTS "Users can view own band mutes" ON public.band_notification_mutes;
CREATE POLICY "Users can view own band mutes"
  ON public.band_notification_mutes FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can mute their bands" ON public.band_notification_mutes;
CREATE POLICY "Users can mute their bands"
  ON public.band_notification_mutes FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.band_members
      WHERE band_members.band_id = band_notification_mutes.band_id
      AND band_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can unmute their bands" ON public.band_notification_mutes;
CREATE POLICY "Users can unmute their bands"
  ON public.band_notification_mutes FOR DELETE
  USING (user_id = auth.uid());

-- notification_events: RLS on and no policies, so clients can neither read
-- nor write it. The default privileges grant ALL to anon/authenticated; take
-- them back too.
REVOKE ALL ON public.notification_events FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Registration RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.register_push_subscription(
  p_endpoint TEXT,
  p_p256dh TEXT,
  p_auth TEXT,
  p_locale TEXT,
  p_user_agent TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_endpoint IS NULL OR p_endpoint !~ '^https://' THEN
    RAISE EXCEPTION 'invalid push endpoint' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, locale, user_agent)
  VALUES (
    v_uid,
    p_endpoint,
    p_p256dh,
    p_auth,
    CASE WHEN p_locale LIKE 'es%' THEN 'es' ELSE 'en' END,
    left(p_user_agent, 300)
  )
  ON CONFLICT (endpoint) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    p256dh = EXCLUDED.p256dh,
    auth = EXCLUDED.auth,
    locale = EXCLUDED.locale,
    user_agent = EXCLUDED.user_agent,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.register_push_subscription(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_subscription(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Enqueue (called by the content triggers)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enqueue_notification_event(
  p_band_id BIGINT,
  p_type TEXT,
  p_entity_id TEXT,
  p_payload JSONB
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notification_events (band_id, actor_id, type, entity_id, payload)
  VALUES (p_band_id, v_actor, p_type, p_entity_id, p_payload);
EXCEPTION WHEN OTHERS THEN
  -- A notification must never make the show / rehearsal / setlist write fail.
  RAISE WARNING 'enqueue_notification_event failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_notification_event(BIGINT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

-- Past or already finished events are history being entered, not news. The
-- dates are floating wall-clock dates; the server runs in UTC, ahead of the
-- band's zone in the Americas, so allow one day of slack.
CREATE OR REPLACE FUNCTION public.notify_show_created() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.event_date < current_date - 1 OR NEW.status IN ('completed', 'cancelled') THEN
    RETURN NEW;
  END IF;

  PERFORM public.enqueue_notification_event(
    NEW.band_id,
    'show.created',
    NEW.id::text,
    jsonb_build_object(
      'name', NEW.name,
      'venue', NEW.venue,
      'date', NEW.event_date,
      'time', NEW.event_time
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_rehearsal_created() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.rehearsal_date < current_date - 1 OR NEW.status IN ('completed', 'cancelled') THEN
    RETURN NEW;
  END IF;

  PERFORM public.enqueue_notification_event(
    NEW.band_id,
    'rehearsal.created',
    NEW.id::text,
    jsonb_build_object(
      'name', NEW.name,
      'location', NEW.location,
      'date', NEW.rehearsal_date,
      'time', NEW.start_time
    )
  );
  RETURN NEW;
END;
$$;

-- A setlist is news when it is created as a non-draft or a draft is published.
-- Items without a `type` are legacy song items (normalizeSetlistItem).
CREATE OR REPLACE FUNCTION public.notify_setlist_published() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_song_count INTEGER;
BEGIN
  IF COALESCE(NEW.is_draft, false) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NOT COALESCE(OLD.is_draft, false) THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_song_count
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(NEW.songs) = 'array' THEN NEW.songs ELSE '[]'::jsonb END
  ) AS item
  WHERE COALESCE(item->>'type', 'song') = 'song';

  PERFORM public.enqueue_notification_event(
    NEW.band_id,
    'setlist.published',
    NEW.id::text,
    jsonb_build_object('name', NEW.name, 'songCount', v_song_count)
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_show_created() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_rehearsal_created() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_setlist_published() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notify_show_created ON public.shows;
CREATE TRIGGER notify_show_created
  AFTER INSERT ON public.shows
  FOR EACH ROW EXECUTE FUNCTION public.notify_show_created();

DROP TRIGGER IF EXISTS notify_rehearsal_created ON public.rehearsals;
CREATE TRIGGER notify_rehearsal_created
  AFTER INSERT ON public.rehearsals
  FOR EACH ROW EXECUTE FUNCTION public.notify_rehearsal_created();

DROP TRIGGER IF EXISTS notify_setlist_published ON public.setlists;
CREATE TRIGGER notify_setlist_published
  AFTER INSERT OR UPDATE OF is_draft ON public.setlists
  FOR EACH ROW EXECUTE FUNCTION public.notify_setlist_published();

-- ---------------------------------------------------------------------------
-- Dispatch: outbox INSERT → Edge Function
-- ---------------------------------------------------------------------------

-- pg_net queues the request and sends it after the transaction commits, so
-- the function always finds the committed event (and a rolled-back write
-- sends nothing).
CREATE OR REPLACE FUNCTION public.dispatch_notification_event() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT;
  v_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'push_function_url';
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'push_function_secret';

  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    body := jsonb_build_object('eventId', NEW.id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_secret
    ),
    timeout_milliseconds := 10000
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- No Vault, no pg_net or a failed enqueue: keep the event, send nothing.
  RAISE WARNING 'dispatch_notification_event failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_notification_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS dispatch_notification_event ON public.notification_events;
CREATE TRIGGER dispatch_notification_event
  AFTER INSERT ON public.notification_events
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_notification_event();
