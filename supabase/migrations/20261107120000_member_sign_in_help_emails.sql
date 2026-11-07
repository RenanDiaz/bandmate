-- Log of "how to sign in" emails sent to band members
-- (docs/specs/member-sign-in-help.md). Written and read only by the
-- `send-sign-in-help` Edge Function (service role), which uses it to limit
-- emails per recipient: one per 10 minutes, three per 24 hours, across bands.
--
-- RLS on with no policies: clients can neither read nor write it (like
-- notification_events). Idempotent: safe to run again on top of itself.

CREATE TABLE IF NOT EXISTS member_sign_in_help_emails (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  band_id BIGINT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE member_sign_in_help_emails IS
  'Sign-in help emails sent by band owners; rate limit of the send-sign-in-help Edge Function.';

CREATE INDEX IF NOT EXISTS member_sign_in_help_emails_recipient_sent_at_idx
  ON member_sign_in_help_emails (recipient_id, sent_at DESC);

ALTER TABLE member_sign_in_help_emails ENABLE ROW LEVEL SECURITY;
