-- Band push notifications: "you were invited to a band"
-- (docs/specs/band-push-notifications.md §3.7).
--
-- An invitation goes to one person, not to the band: the event's recipient is
-- the account whose email the invitation names, resolved here (the trigger
-- can read auth.users) and stored as payload.inviteeId. No account with that
-- email → no event (the invitation email is the only channel). The token is
-- never copied into the outbox: the notification opens the dashboard, which
-- lists pending invitations for the signed-in email.
--
-- Nothing in here may make the invitation write fail.

ALTER TABLE public.notification_events
  DROP CONSTRAINT IF EXISTS notification_events_type_check;
ALTER TABLE public.notification_events
  ADD CONSTRAINT notification_events_type_check CHECK (type IN (
    'show.created', 'rehearsal.created', 'setlist.published',
    'show.moved', 'show.cancelled', 'rehearsal.moved', 'rehearsal.cancelled',
    'invitation.created'
  ));

CREATE OR REPLACE FUNCTION public.notify_invitation_created() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitee UUID;
BEGIN
  IF NEW.status IS DISTINCT FROM 'pending' OR NEW.expires_at <= now() THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_invitee
  FROM auth.users
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  IF v_invitee IS NULL THEN
    RETURN NEW;
  END IF;

  -- Already in the band: nothing to accept.
  IF EXISTS (
    SELECT 1 FROM public.band_members
    WHERE band_id = NEW.band_id AND user_id = v_invitee
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM public.enqueue_notification_event(
    NEW.band_id,
    'invitation.created',
    NEW.id::text,
    jsonb_build_object('inviteeId', v_invitee, 'role', NEW.role)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_invitation_created failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_invitation_created() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notify_invitation_created ON public.band_invitations;
CREATE TRIGGER notify_invitation_created
  AFTER INSERT ON public.band_invitations
  FOR EACH ROW EXECUTE FUNCTION public.notify_invitation_created();
