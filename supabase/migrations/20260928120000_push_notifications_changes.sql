-- Band push notifications, Phase 2: a show or rehearsal moved or cancelled
-- (docs/specs/band-push-notifications.md §3.5).
--
-- An UPDATE that changes the date, time or place, or cancels, keeps ONE
-- pending row per entity in notification_events with send_after two minutes
-- ahead. Every later edit inside that window re-decides the row from its
-- `before` snapshot (the values when the window opened): moved and moved back
-- deletes it, cancel replaces moved. pg_cron posts due rows to the Edge
-- Function, and re-posts dispatched rows the function never claimed.
--
-- Phase 1 rows keep send_after null and are posted at once, as before.
-- Nothing in here may make the user's write fail.

-- pg_cron is enabled from the dashboard on Supabase; without it changes are
-- recorded and never sent (docs/setup/push-notifications.md §6).
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available (%): deferred push dispatch is disabled', SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- Outbox columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.notification_events
  ADD COLUMN IF NOT EXISTS send_after TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispatch_attempts SMALLINT NOT NULL DEFAULT 0,
  -- Derived, so callers can't write a kind that disagrees with the type.
  ADD COLUMN IF NOT EXISTS entity_kind TEXT GENERATED ALWAYS AS (split_part(type, '.', 1)) STORED;

COMMENT ON COLUMN public.notification_events.send_after IS
  'null = post at once (created events); otherwise the end of the 2-minute coalescing window.';
COMMENT ON COLUMN public.notification_events.dispatched_at IS
  'Last pg_net post to send-push-notifications; the cron re-posts unclaimed rows after 10 minutes.';

ALTER TABLE public.notification_events
  DROP CONSTRAINT IF EXISTS notification_events_type_check;
ALTER TABLE public.notification_events
  ADD CONSTRAINT notification_events_type_check CHECK (type IN (
    'show.created', 'rehearsal.created', 'setlist.published',
    'show.moved', 'show.cancelled', 'rehearsal.moved', 'rehearsal.cancelled'
  ));

-- At most one pending change per entity; also the trigger's lookup.
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_events_pending_change
  ON public.notification_events (entity_kind, entity_id)
  WHERE send_after IS NOT NULL AND processed_at IS NULL AND dispatched_at IS NULL;

-- The cron scan.
CREATE INDEX IF NOT EXISTS idx_notification_events_due
  ON public.notification_events (send_after)
  WHERE processed_at IS NULL;

-- ---------------------------------------------------------------------------
-- Enqueue a change (called by the show / rehearsal UPDATE triggers)
-- ---------------------------------------------------------------------------

-- p_old / p_new: { date, time, place, status } of the row before and after
-- the UPDATE. Dates are floating wall-clock dates; "past" allows the same
-- one day of slack as the Phase 1 triggers.
CREATE OR REPLACE FUNCTION public.enqueue_change_event(
  p_band_id BIGINT,
  p_kind TEXT,
  p_entity_id TEXT,
  p_name TEXT,
  p_old JSONB,
  p_new JSONB
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_pending_id BIGINT;
  v_before JSONB;
  v_type TEXT;
BEGIN
  IF v_actor IS NULL THEN
    RETURN;
  END IF;

  -- A dispatched row belongs to the sender: a later edit opens a new window.
  SELECT id, payload->'before' INTO v_pending_id, v_before
  FROM public.notification_events
  WHERE entity_kind = p_kind
    AND entity_id = p_entity_id
    AND send_after IS NOT NULL
    AND processed_at IS NULL
    AND dispatched_at IS NULL
  FOR UPDATE;

  v_before := COALESCE(v_before, p_old);

  -- Decided from the window's first values to the current ones only.
  IF v_before->>'status' = 'cancelled' OR p_new->>'status' = 'completed' THEN
    v_type := NULL;
  ELSIF (v_before->>'date')::date < current_date - 1
    AND (p_new->>'date')::date < current_date - 1 THEN
    v_type := NULL;
  ELSIF p_new->>'status' = 'cancelled' THEN
    v_type := p_kind || '.cancelled';
  ELSIF v_before->'date' IS DISTINCT FROM p_new->'date'
    OR v_before->'time' IS DISTINCT FROM p_new->'time'
    OR v_before->'place' IS DISTINCT FROM p_new->'place' THEN
    v_type := p_kind || '.moved';
  ELSE
    v_type := NULL;
  END IF;

  IF v_type IS NULL THEN
    IF v_pending_id IS NOT NULL THEN
      DELETE FROM public.notification_events WHERE id = v_pending_id;
    END IF;
    RETURN;
  END IF;

  IF v_pending_id IS NOT NULL THEN
    UPDATE public.notification_events SET
      band_id = p_band_id,
      -- The last editor is the one who isn't notified.
      actor_id = v_actor,
      type = v_type,
      payload = jsonb_build_object('name', p_name, 'before', v_before, 'after', p_new),
      send_after = now() + interval '2 minutes'
    WHERE id = v_pending_id;
  ELSE
    INSERT INTO public.notification_events (band_id, actor_id, type, entity_id, payload, send_after)
    VALUES (
      p_band_id,
      v_actor,
      v_type,
      p_entity_id,
      jsonb_build_object('name', p_name, 'before', v_before, 'after', p_new),
      now() + interval '2 minutes'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- A notification must never make the show / rehearsal write fail.
  RAISE WARNING 'enqueue_change_event failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_change_event(BIGINT, TEXT, TEXT, TEXT, JSONB, JSONB) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_show_changed() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enqueue_change_event(
    NEW.band_id,
    'show',
    NEW.id::text,
    NEW.name,
    jsonb_build_object('date', OLD.event_date, 'time', OLD.event_time, 'place', OLD.venue, 'status', OLD.status),
    jsonb_build_object('date', NEW.event_date, 'time', NEW.event_time, 'place', NEW.venue, 'status', NEW.status)
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_rehearsal_changed() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enqueue_change_event(
    NEW.band_id,
    'rehearsal',
    NEW.id::text,
    NEW.name,
    jsonb_build_object('date', OLD.rehearsal_date, 'time', OLD.start_time, 'place', OLD.location, 'status', OLD.status),
    jsonb_build_object('date', NEW.rehearsal_date, 'time', NEW.start_time, 'place', NEW.location, 'status', NEW.status)
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_show_changed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_rehearsal_changed() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notify_show_changed ON public.shows;
CREATE TRIGGER notify_show_changed
  AFTER UPDATE ON public.shows
  FOR EACH ROW
  WHEN (
    OLD.event_date IS DISTINCT FROM NEW.event_date
    OR OLD.event_time IS DISTINCT FROM NEW.event_time
    OR OLD.venue IS DISTINCT FROM NEW.venue
    OR OLD.status IS DISTINCT FROM NEW.status
  )
  EXECUTE FUNCTION public.notify_show_changed();

DROP TRIGGER IF EXISTS notify_rehearsal_changed ON public.rehearsals;
CREATE TRIGGER notify_rehearsal_changed
  AFTER UPDATE ON public.rehearsals
  FOR EACH ROW
  WHEN (
    OLD.rehearsal_date IS DISTINCT FROM NEW.rehearsal_date
    OR OLD.start_time IS DISTINCT FROM NEW.start_time
    OR OLD.location IS DISTINCT FROM NEW.location
    OR OLD.status IS DISTINCT FROM NEW.status
  )
  EXECUTE FUNCTION public.notify_rehearsal_changed();

-- ---------------------------------------------------------------------------
-- Dispatch
-- ---------------------------------------------------------------------------

-- Posts one event to the Edge Function and stamps the attempt. false when
-- Vault has no URL / secret (nothing posted, nothing stamped). Errors
-- propagate: the callers catch them.
CREATE OR REPLACE FUNCTION public.post_notification_event(p_event_id BIGINT) RETURNS boolean
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
    RETURN false;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    body := jsonb_build_object('eventId', p_event_id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_secret
    ),
    timeout_milliseconds := 10000
  );

  UPDATE public.notification_events
  SET dispatched_at = now(), dispatch_attempts = dispatch_attempts + 1
  WHERE id = p_event_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.post_notification_event(BIGINT) FROM PUBLIC, anon, authenticated;

-- Created events (send_after null) are posted at once, as in Phase 1;
-- changes wait for the cron.
CREATE OR REPLACE FUNCTION public.dispatch_notification_event() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.send_after IS NOT NULL THEN
    RETURN NEW;
  END IF;
  PERFORM public.post_notification_event(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- No Vault, no pg_net or a failed enqueue: keep the event, send nothing.
  RAISE WARNING 'dispatch_notification_event failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Every minute (pg_cron): post changes whose window closed, and re-post
-- events dispatched more than 10 minutes ago that the function never claimed
-- (a lost pg_net call). At most 3 posts per event, within a day of it.
-- Never-dispatched rows with send_after null (Vault was missing) stay put.
CREATE OR REPLACE FUNCTION public.dispatch_due_notification_events() RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id BIGINT;
  v_posted INTEGER := 0;
BEGIN
  FOR v_id IN
    SELECT id FROM public.notification_events
    WHERE processed_at IS NULL
      AND dispatch_attempts < 3
      AND created_at > now() - interval '1 day'
      AND (
        (dispatched_at IS NULL AND send_after IS NOT NULL AND send_after <= now())
        OR dispatched_at < now() - interval '10 minutes'
      )
    ORDER BY id
    LIMIT 100
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      IF NOT public.post_notification_event(v_id) THEN
        RETURN v_posted;
      END IF;
      v_posted := v_posted + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'dispatch_due_notification_events: event % failed: %', v_id, SQLERRM;
    END;
  END LOOP;
  RETURN v_posted;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_due_notification_events() FROM PUBLIC, anon, authenticated;

-- Schedule it (again, if pg_cron is enabled after this migration: the setup
-- guide repeats this block).
DO $$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE NOTICE 'pg_cron not enabled: dispatch-notification-events not scheduled';
    RETURN;
  END IF;
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'dispatch-notification-events';
  PERFORM cron.schedule(
    'dispatch-notification-events',
    '* * * * *',
    'select public.dispatch_due_notification_events()'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'dispatch-notification-events not scheduled: %', SQLERRM;
END $$;
