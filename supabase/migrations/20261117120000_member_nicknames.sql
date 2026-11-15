-- Member names and nicknames (docs/specs/member-names.md).
--
-- 1. band_members.nickname: what the band calls a member (per band, 1–40
--    characters, null = none).
-- 2. get_band_members_with_emails: returns the nickname, and only to a
--    member of that band (it answered any caller, the anon key included).
-- 3. set_band_member_nickname: the band's owner sets anyone's nickname,
--    each member their own. band_members has no RLS: this is the gate.
-- 4. get_band_member_names: display names (nickname -> name -> email) for a
--    set of users in one call, for request authors and the sync host.

ALTER TABLE public.band_members ADD COLUMN IF NOT EXISTS nickname text;

DO $$
BEGIN
  ALTER TABLE public.band_members
    ADD CONSTRAINT band_members_nickname_length
    CHECK (nickname IS NULL OR char_length(nickname) BETWEEN 1 AND 40);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- The return type changes (new column), so drop and recreate.
DROP FUNCTION IF EXISTS public.get_band_members_with_emails(bigint);

CREATE FUNCTION public.get_band_members_with_emails(band_id_param bigint)
RETURNS TABLE (
  id uuid,
  band_id bigint,
  user_id uuid,
  role text,
  invited_by uuid,
  joined_at timestamp with time zone,
  expires_at timestamp with time zone,
  created_at timestamp with time zone,
  email text,
  user_metadata jsonb,
  nickname text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.band_members AS me
    WHERE me.band_id = band_id_param AND me.user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    bm.id,
    bm.band_id,
    bm.user_id,
    bm.role,
    bm.invited_by,
    bm.joined_at,
    bm.expires_at,
    bm.created_at,
    u.email::text,
    u.raw_user_meta_data,
    bm.nickname
  FROM public.band_members AS bm
  LEFT JOIN auth.users AS u ON u.id = bm.user_id
  WHERE bm.band_id = band_id_param
  ORDER BY bm.joined_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_band_members_with_emails(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_band_members_with_emails(bigint) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_band_member_nickname(
  band_id_param bigint,
  user_id_param uuid,
  nickname_param text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller uuid := auth.uid();
  cleaned text := NULLIF(btrim(nickname_param), '');
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF caller <> user_id_param AND NOT EXISTS (
    SELECT 1 FROM public.band_members AS owner_row
    WHERE owner_row.band_id = band_id_param
      AND owner_row.user_id = caller
      AND owner_row.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Only the band owner can change another member''s nickname'
      USING ERRCODE = '42501';
  END IF;

  IF cleaned IS NOT NULL AND char_length(cleaned) > 40 THEN
    RAISE EXCEPTION 'Nickname too long' USING ERRCODE = '22001';
  END IF;

  UPDATE public.band_members AS bm
  SET nickname = cleaned
  WHERE bm.band_id = band_id_param AND bm.user_id = user_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a member of this band' USING ERRCODE = 'P0002';
  END IF;

  RETURN cleaned;
END;
$$;

REVOKE ALL ON FUNCTION public.set_band_member_nickname(bigint, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_band_member_nickname(bigint, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_band_member_names(band_id_param bigint, user_ids uuid[])
RETURNS TABLE (user_id uuid, display_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.band_members AS me
    WHERE me.band_id = band_id_param AND me.user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  -- Members: nickname, else name, else email. Someone no longer in the band
  -- (an old comment's author): name only, never their email.
  RETURN QUERY
  SELECT
    u.id,
    COALESCE(
      bm.nickname,
      NULLIF(btrim(u.raw_user_meta_data->>'full_name'), ''),
      NULLIF(btrim(u.raw_user_meta_data->>'name'), ''),
      CASE WHEN bm.user_id IS NOT NULL THEN u.email::text END
    )
  FROM auth.users AS u
  LEFT JOIN public.band_members AS bm
    ON bm.band_id = band_id_param AND bm.user_id = u.id
  WHERE u.id = ANY (user_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.get_band_member_names(bigint, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_band_member_names(bigint, uuid[]) TO authenticated, service_role;
