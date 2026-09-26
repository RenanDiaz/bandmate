-- Baseline: the production schema as it was before the first CLI migration
-- (20260117171019). Generated on 2026-09-26 with
--   supabase db dump --linked --schema public
-- plus the parts that live outside `public` (end of file). It replaces the
-- legacy files in migrations/, which built this schema by hand and are kept
-- for history only.
--
-- Already applied in production: it is marked applied there with
--   supabase migration repair --status applied 20260101000000
-- so `supabase db push` never runs it. It only runs on a fresh database
-- (`supabase db reset`, a new project), followed by every later migration.
--
-- It is a snapshot of 2026-09-26, so it already contains the changes of the
-- migrations that follow it (columns, the band avatar policy, sheet music
-- preferences, calendar options). Those migrations are idempotent, so running
-- them on top of this is a no-op.
--
-- Known: production still carries legacy owner-only / creator-only policies
-- on `songs` and `setlists` (e.g. "Users can update their setlists"). They
-- are reproduced here as they are; 20260927120000_align_content_rls_with_roles
-- drops them (docs/specs/content-permissions.md).




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."rehearsal_status" AS ENUM (
    'scheduled',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."rehearsal_status" OWNER TO "postgres";


CREATE TYPE "public"."request_status" AS ENUM (
    'pending',
    'approved',
    'rejected',
    'in_progress',
    'completed',
    'withdrawn'
);


ALTER TYPE "public"."request_status" OWNER TO "postgres";


CREATE TYPE "public"."request_type" AS ENUM (
    'new_song',
    'backing_track',
    'setlist_proposal',
    'song_change',
    'general'
);


ALTER TYPE "public"."request_type" OWNER TO "postgres";


CREATE TYPE "public"."show_status" AS ENUM (
    'upcoming',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."show_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_performance_sessions"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM performance_sessions
  WHERE is_active = false
    AND updated_at < NOW() - INTERVAL '24 hours';

  -- Also deactivate sessions that haven't been updated in 4 hours
  UPDATE performance_sessions
  SET is_active = false
  WHERE is_active = true
    AND updated_at < NOW() - INTERVAL '4 hours';
END;
$$;


ALTER FUNCTION "public"."cleanup_old_performance_sessions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_guest_memberships"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM band_members
  WHERE role = 'guest'
  AND expires_at IS NOT NULL
  AND expires_at < NOW();
END;
$$;


ALTER FUNCTION "public"."expire_guest_memberships"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_session_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."generate_session_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_band_members_with_emails"("band_id_param" bigint) RETURNS TABLE("id" "uuid", "band_id" bigint, "user_id" "uuid", "role" "text", "invited_by" "uuid", "joined_at" timestamp with time zone, "expires_at" timestamp with time zone, "created_at" timestamp with time zone, "email" "text", "user_metadata" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
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
    u.email::TEXT,
    u.raw_user_meta_data as user_metadata
  FROM band_members bm
  LEFT JOIN auth.users u ON u.id = bm.user_id
  WHERE bm.band_id = band_id_param
  ORDER BY bm.joined_at ASC;
END;
$$;


ALTER FUNCTION "public"."get_band_members_with_emails"("band_id_param" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_band_role"("band_id_param" bigint, "user_id_param" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM band_members
  WHERE band_id = band_id_param
  AND user_id = user_id_param;

  RETURN user_role;
END;
$$;


ALTER FUNCTION "public"."get_band_role"("band_id_param" bigint, "user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_user_email"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN (SELECT email FROM auth.users WHERE id = auth.uid());
END;
$$;


ALTER FUNCTION "public"."get_current_user_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_request_vote_count"("request_uuid" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  vote_count INTEGER;
BEGIN
  SELECT COALESCE(
    SUM(CASE WHEN vote_type = 'up' THEN 1 WHEN vote_type = 'down' THEN -1 ELSE 0 END),
    0
  ) INTO vote_count
  FROM request_votes
  WHERE request_id = request_uuid;

  RETURN vote_count;
END;
$$;


ALTER FUNCTION "public"."get_request_vote_count"("request_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_display_name"("user_id_param" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  display_name TEXT;
BEGIN
  SELECT
    COALESCE(
      raw_user_meta_data->>'full_name',
      raw_user_meta_data->>'name',
      email
    ) INTO display_name
  FROM auth.users
  WHERE id = user_id_param;

  RETURN display_name;
END;
$$;


ALTER FUNCTION "public"."get_user_display_name"("user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_band_member"("band_id_param" bigint, "user_id_param" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM band_members
    WHERE band_id = band_id_param
    AND user_id = user_id_param
  );
END;
$$;


ALTER FUNCTION "public"."is_band_member"("band_id_param" bigint, "user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_band_owner"("band_id_param" bigint, "user_id_param" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM bands
    WHERE id = band_id_param
    AND owner_id = user_id_param
  );
END;
$$;


ALTER FUNCTION "public"."is_band_owner"("band_id_param" bigint, "user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transfer_band_ownership"("p_band_id" bigint, "p_new_owner_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- The caller must currently own the band.
  IF NOT EXISTS (
    SELECT 1 FROM bands WHERE id = p_band_id AND owner_id = v_caller
  ) THEN
    RAISE EXCEPTION 'Only the current owner can transfer ownership';
  END IF;

  IF p_new_owner_id = v_caller THEN
    RAISE EXCEPTION 'You already own this band';
  END IF;

  -- The new owner must already be a member of the band.
  IF NOT EXISTS (
    SELECT 1 FROM band_members WHERE band_id = p_band_id AND user_id = p_new_owner_id
  ) THEN
    RAISE EXCEPTION 'The new owner must be a member of the band';
  END IF;

  -- Promote the new owner.
  UPDATE band_members SET role = 'owner'
  WHERE band_id = p_band_id AND user_id = p_new_owner_id;

  -- Demote the previous owner to admin.
  UPDATE band_members SET role = 'admin'
  WHERE band_id = p_band_id AND user_id = v_caller;

  -- Point the band at its new owner.
  UPDATE bands SET owner_id = p_new_owner_id WHERE id = p_band_id;
END;
$$;


ALTER FUNCTION "public"."transfer_band_ownership"("p_band_id" bigint, "p_new_owner_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_calendar_subscriptions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_calendar_subscriptions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_performance_sessions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_performance_sessions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_rehearsals_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_rehearsals_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_request_comments_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_request_comments_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_requests_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_requests_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_shows_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_shows_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."band_invitations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "band_id" bigint NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "band_invitations_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'member'::"text", 'guest'::"text"]))),
    CONSTRAINT "band_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."band_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."band_members" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "band_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "invited_by" "uuid",
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "band_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text", 'guest'::"text"])))
);


ALTER TABLE "public"."band_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bands" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "genre" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "avatar_url" "text"
);


ALTER TABLE "public"."bands" OWNER TO "postgres";


COMMENT ON COLUMN "public"."bands"."avatar_url" IS 'Public URL of the band avatar/logo stored in the band-avatars bucket';



CREATE SEQUENCE IF NOT EXISTS "public"."bands_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."bands_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."bands_id_seq" OWNED BY "public"."bands"."id";



CREATE TABLE IF NOT EXISTS "public"."calendar_subscriptions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "band_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "include_shows" boolean DEFAULT true NOT NULL,
    "include_rehearsals" boolean DEFAULT true NOT NULL,
    "timezone" "text"
);


ALTER TABLE "public"."calendar_subscriptions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."calendar_subscriptions"."timezone" IS 'IANA time zone of the subscriber (set from the browser), sent as X-WR-TIMEZONE.';



CREATE TABLE IF NOT EXISTS "public"."performance_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "setlist_id" "uuid" NOT NULL,
    "band_id" bigint NOT NULL,
    "host_user_id" "uuid" NOT NULL,
    "current_song_index" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "current_time_ms" integer DEFAULT 0,
    "is_playing" boolean DEFAULT false,
    "playback_updated_at" timestamp with time zone
);


ALTER TABLE "public"."performance_sessions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."performance_sessions"."current_time_ms" IS 'Current audio playback position in milliseconds';



COMMENT ON COLUMN "public"."performance_sessions"."is_playing" IS 'Whether audio is currently playing on host device';



COMMENT ON COLUMN "public"."performance_sessions"."playback_updated_at" IS 'Timestamp of last playback state update for latency compensation';



CREATE TABLE IF NOT EXISTS "public"."rehearsals" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "band_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "show_id" "uuid",
    "setlist_id" "uuid",
    "name" "text",
    "location" "text",
    "rehearsal_date" "date" NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "notes" "text",
    "status" "public"."rehearsal_status" DEFAULT 'scheduled'::"public"."rehearsal_status",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."rehearsals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."request_comments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."request_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."request_votes" (
    "request_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "vote_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "request_votes_vote_type_check" CHECK (("vote_type" = ANY (ARRAY['up'::"text", 'down'::"text"])))
);


ALTER TABLE "public"."request_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "band_id" bigint NOT NULL,
    "created_by" "uuid" NOT NULL,
    "request_type" "public"."request_type" NOT NULL,
    "status" "public"."request_status" DEFAULT 'pending'::"public"."request_status",
    "title" "text" NOT NULL,
    "description" "text",
    "request_data" "jsonb" DEFAULT '{}'::"jsonb",
    "related_song_id" "uuid",
    "related_setlist_id" "uuid",
    "related_show_id" "uuid",
    "resolved_by" "uuid",
    "resolved_at" timestamp with time zone,
    "resolution_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."setlists" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "band_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "songs" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_draft" boolean DEFAULT false
);


ALTER TABLE "public"."setlists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shows" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "band_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "setlist_id" "uuid",
    "name" "text" NOT NULL,
    "venue" "text",
    "venue_address" "text",
    "event_date" "date" NOT NULL,
    "event_time" time without time zone,
    "doors_time" time without time zone,
    "status" "public"."show_status" DEFAULT 'upcoming'::"public"."show_status",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "soundcheck_time" time without time zone
);


ALTER TABLE "public"."shows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."song_sheet_music" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "song_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "instrument" "text",
    "file_url" "text" NOT NULL,
    "page_timings" "jsonb" DEFAULT '[]'::"jsonb",
    "position" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."song_sheet_music" OWNER TO "postgres";


COMMENT ON TABLE "public"."song_sheet_music" IS 'Stores sheet music PDFs for songs. Each song can have multiple PDFs (one per instrument).';



COMMENT ON COLUMN "public"."song_sheet_music"."name" IS 'Display name for the sheet music (e.g., Guitar, Piano, Vocals)';



COMMENT ON COLUMN "public"."song_sheet_music"."instrument" IS 'Optional instrument identifier for filtering and icons';



COMMENT ON COLUMN "public"."song_sheet_music"."file_url" IS 'Path to PDF file in Supabase Storage (sheet-music bucket)';



COMMENT ON COLUMN "public"."song_sheet_music"."page_timings" IS 'JSONB array of page timing data for syncing with audio: [{page: 1, startTime: 0.0}, ...]';



COMMENT ON COLUMN "public"."song_sheet_music"."position" IS 'Order position for displaying multiple sheet music files';



CREATE TABLE IF NOT EXISTS "public"."songs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "band_id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "artist" "text",
    "lyrics" "text",
    "chords" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "key" "text",
    "tempo" integer,
    "duration" integer,
    "tags" "text"[],
    "album" "text",
    "album_art" "text",
    "release_date" "text",
    "spotify_url" "text",
    "time_signature" integer,
    "energy" numeric(3,2),
    "danceability" numeric(3,2),
    "language" "text",
    "country" "text",
    "has_backing_tracks" boolean DEFAULT false,
    "timing_data" "jsonb",
    "original_key" "text",
    "popularity" integer,
    CONSTRAINT "duration_positive" CHECK ((("duration" IS NULL) OR ("duration" > 0))),
    CONSTRAINT "tempo_positive" CHECK ((("tempo" IS NULL) OR ("tempo" > 0)))
);


ALTER TABLE "public"."songs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."songs"."album" IS 'Album name from Spotify metadata';



COMMENT ON COLUMN "public"."songs"."album_art" IS 'URL to album artwork from Spotify';



COMMENT ON COLUMN "public"."songs"."release_date" IS 'Release date in YYYY-MM-DD format';



COMMENT ON COLUMN "public"."songs"."spotify_url" IS 'Spotify URL for the track';



COMMENT ON COLUMN "public"."songs"."time_signature" IS 'Time signature (3, 4, 5, etc.)';



COMMENT ON COLUMN "public"."songs"."energy" IS 'Energy level from 0.0 to 1.0 (Spotify audio features)';



COMMENT ON COLUMN "public"."songs"."danceability" IS 'Danceability from 0.0 to 1.0 (Spotify audio features)';



COMMENT ON COLUMN "public"."songs"."language" IS 'Language of the song (e.g., English, Spanish, French)';



COMMENT ON COLUMN "public"."songs"."country" IS 'Country of origin (e.g., USA, UK, Mexico)';



COMMENT ON COLUMN "public"."songs"."has_backing_tracks" IS 'Indicates if the song has backing tracks or sequences';



COMMENT ON COLUMN "public"."songs"."timing_data" IS 'JSONB containing timing data for syncing lyrics/chords with audio. Contains sectionTimings and/or lineTimings arrays.';



COMMENT ON COLUMN "public"."songs"."original_key" IS 'The original key of the song before transposition. The key field contains the current (possibly transposed) key.';



COMMENT ON COLUMN "public"."songs"."popularity" IS 'Popularity score from 0 to 100 (Spotify popularity)';



CREATE TABLE IF NOT EXISTS "public"."user_sheet_music_preferences" (
    "user_id" "uuid" NOT NULL,
    "song_id" "uuid" NOT NULL,
    "sheet_music_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_sheet_music_preferences" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_sheet_music_preferences" IS 'Which sheet music PDF each user wants opened first for a song (performance mode).';



COMMENT ON COLUMN "public"."user_sheet_music_preferences"."sheet_music_id" IS 'The preferred song_sheet_music row. Must belong to song_id (checked in the app).';



ALTER TABLE ONLY "public"."bands" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."bands_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."band_invitations"
    ADD CONSTRAINT "band_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."band_invitations"
    ADD CONSTRAINT "band_invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."band_members"
    ADD CONSTRAINT "band_members_band_id_user_id_key" UNIQUE ("band_id", "user_id");



ALTER TABLE ONLY "public"."band_members"
    ADD CONSTRAINT "band_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bands"
    ADD CONSTRAINT "bands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_subscriptions"
    ADD CONSTRAINT "calendar_subscriptions_band_id_user_id_key" UNIQUE ("band_id", "user_id");



ALTER TABLE ONLY "public"."calendar_subscriptions"
    ADD CONSTRAINT "calendar_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."performance_sessions"
    ADD CONSTRAINT "performance_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rehearsals"
    ADD CONSTRAINT "rehearsals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."request_comments"
    ADD CONSTRAINT "request_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."request_votes"
    ADD CONSTRAINT "request_votes_pkey" PRIMARY KEY ("request_id", "user_id");



ALTER TABLE ONLY "public"."requests"
    ADD CONSTRAINT "requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."setlists"
    ADD CONSTRAINT "setlists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shows"
    ADD CONSTRAINT "shows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."song_sheet_music"
    ADD CONSTRAINT "song_sheet_music_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_sheet_music_preferences"
    ADD CONSTRAINT "user_sheet_music_preferences_pkey" PRIMARY KEY ("user_id", "song_id");



CREATE INDEX "idx_band_invitations_band_id" ON "public"."band_invitations" USING "btree" ("band_id");



CREATE INDEX "idx_band_invitations_email" ON "public"."band_invitations" USING "btree" ("email");



CREATE INDEX "idx_band_invitations_status" ON "public"."band_invitations" USING "btree" ("status");



CREATE INDEX "idx_band_invitations_token" ON "public"."band_invitations" USING "btree" ("token");



CREATE INDEX "idx_band_members_band_id" ON "public"."band_members" USING "btree" ("band_id");



CREATE INDEX "idx_band_members_role" ON "public"."band_members" USING "btree" ("role");



CREATE INDEX "idx_band_members_user_id" ON "public"."band_members" USING "btree" ("user_id");



CREATE INDEX "idx_bands_owner_id" ON "public"."bands" USING "btree" ("owner_id");



CREATE INDEX "idx_calendar_subscriptions_band_user" ON "public"."calendar_subscriptions" USING "btree" ("band_id", "user_id");



CREATE UNIQUE INDEX "idx_calendar_subscriptions_token" ON "public"."calendar_subscriptions" USING "btree" ("token");



CREATE INDEX "idx_performance_sessions_active_playback" ON "public"."performance_sessions" USING "btree" ("band_id", "is_active", "is_playing") WHERE ("is_active" = true);



CREATE INDEX "idx_performance_sessions_band_active" ON "public"."performance_sessions" USING "btree" ("band_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_performance_sessions_band_id" ON "public"."performance_sessions" USING "btree" ("band_id");



CREATE INDEX "idx_performance_sessions_is_active" ON "public"."performance_sessions" USING "btree" ("is_active");



CREATE INDEX "idx_performance_sessions_setlist_id" ON "public"."performance_sessions" USING "btree" ("setlist_id");



CREATE INDEX "idx_rehearsals_band_id" ON "public"."rehearsals" USING "btree" ("band_id");



CREATE INDEX "idx_rehearsals_rehearsal_date" ON "public"."rehearsals" USING "btree" ("rehearsal_date");



CREATE INDEX "idx_rehearsals_setlist_id" ON "public"."rehearsals" USING "btree" ("setlist_id");



CREATE INDEX "idx_rehearsals_show_id" ON "public"."rehearsals" USING "btree" ("show_id");



CREATE INDEX "idx_rehearsals_status" ON "public"."rehearsals" USING "btree" ("status");



CREATE INDEX "idx_request_comments_request_id" ON "public"."request_comments" USING "btree" ("request_id");



CREATE INDEX "idx_request_comments_user_id" ON "public"."request_comments" USING "btree" ("user_id");



CREATE INDEX "idx_request_votes_request_id" ON "public"."request_votes" USING "btree" ("request_id");



CREATE INDEX "idx_request_votes_user_id" ON "public"."request_votes" USING "btree" ("user_id");



CREATE INDEX "idx_requests_band_id" ON "public"."requests" USING "btree" ("band_id");



CREATE INDEX "idx_requests_created_at" ON "public"."requests" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_requests_created_by" ON "public"."requests" USING "btree" ("created_by");



CREATE INDEX "idx_requests_related_setlist_id" ON "public"."requests" USING "btree" ("related_setlist_id");



CREATE INDEX "idx_requests_related_show_id" ON "public"."requests" USING "btree" ("related_show_id");



CREATE INDEX "idx_requests_related_song_id" ON "public"."requests" USING "btree" ("related_song_id");



CREATE INDEX "idx_requests_request_type" ON "public"."requests" USING "btree" ("request_type");



CREATE INDEX "idx_requests_status" ON "public"."requests" USING "btree" ("status");



CREATE INDEX "idx_setlists_band_id" ON "public"."setlists" USING "btree" ("band_id");



CREATE INDEX "idx_setlists_is_draft" ON "public"."setlists" USING "btree" ("is_draft");



CREATE INDEX "idx_setlists_user_id" ON "public"."setlists" USING "btree" ("user_id");



CREATE INDEX "idx_sheet_music_position" ON "public"."song_sheet_music" USING "btree" ("song_id", "position");



CREATE INDEX "idx_sheet_music_song_id" ON "public"."song_sheet_music" USING "btree" ("song_id");



CREATE INDEX "idx_shows_band_id" ON "public"."shows" USING "btree" ("band_id");



CREATE INDEX "idx_shows_event_date" ON "public"."shows" USING "btree" ("event_date");



CREATE INDEX "idx_shows_setlist_id" ON "public"."shows" USING "btree" ("setlist_id");



CREATE INDEX "idx_shows_status" ON "public"."shows" USING "btree" ("status");



CREATE INDEX "idx_songs_band_id" ON "public"."songs" USING "btree" ("band_id");



CREATE INDEX "idx_songs_duration" ON "public"."songs" USING "btree" ("duration");



CREATE INDEX "idx_songs_has_timing" ON "public"."songs" USING "btree" ((("timing_data" IS NOT NULL)));



CREATE INDEX "idx_songs_key" ON "public"."songs" USING "btree" ("key");



CREATE INDEX "idx_songs_spotify_url" ON "public"."songs" USING "btree" ("spotify_url");



CREATE INDEX "idx_songs_tags" ON "public"."songs" USING "gin" ("tags");



CREATE INDEX "idx_songs_tempo" ON "public"."songs" USING "btree" ("tempo");



CREATE INDEX "idx_songs_user_id" ON "public"."songs" USING "btree" ("user_id");



CREATE INDEX "idx_user_sheet_music_preferences_sheet" ON "public"."user_sheet_music_preferences" USING "btree" ("sheet_music_id");



CREATE OR REPLACE TRIGGER "calendar_subscriptions_updated_at" BEFORE UPDATE ON "public"."calendar_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_calendar_subscriptions_updated_at"();



CREATE OR REPLACE TRIGGER "performance_sessions_updated_at" BEFORE UPDATE ON "public"."performance_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_performance_sessions_updated_at"();



CREATE OR REPLACE TRIGGER "rehearsals_updated_at" BEFORE UPDATE ON "public"."rehearsals" FOR EACH ROW EXECUTE FUNCTION "public"."update_rehearsals_updated_at"();



CREATE OR REPLACE TRIGGER "request_comments_updated_at" BEFORE UPDATE ON "public"."request_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_request_comments_updated_at"();



CREATE OR REPLACE TRIGGER "requests_updated_at" BEFORE UPDATE ON "public"."requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_requests_updated_at"();



CREATE OR REPLACE TRIGGER "shows_updated_at" BEFORE UPDATE ON "public"."shows" FOR EACH ROW EXECUTE FUNCTION "public"."update_shows_updated_at"();



CREATE OR REPLACE TRIGGER "update_sheet_music_updated_at" BEFORE UPDATE ON "public"."song_sheet_music" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_sheet_music_preferences_updated_at" BEFORE UPDATE ON "public"."user_sheet_music_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."band_invitations"
    ADD CONSTRAINT "band_invitations_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."band_invitations"
    ADD CONSTRAINT "band_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."band_members"
    ADD CONSTRAINT "band_members_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."band_members"
    ADD CONSTRAINT "band_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."band_members"
    ADD CONSTRAINT "band_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bands"
    ADD CONSTRAINT "bands_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_subscriptions"
    ADD CONSTRAINT "calendar_subscriptions_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_subscriptions"
    ADD CONSTRAINT "calendar_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."performance_sessions"
    ADD CONSTRAINT "performance_sessions_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."performance_sessions"
    ADD CONSTRAINT "performance_sessions_host_user_id_fkey" FOREIGN KEY ("host_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."performance_sessions"
    ADD CONSTRAINT "performance_sessions_setlist_id_fkey" FOREIGN KEY ("setlist_id") REFERENCES "public"."setlists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rehearsals"
    ADD CONSTRAINT "rehearsals_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rehearsals"
    ADD CONSTRAINT "rehearsals_setlist_id_fkey" FOREIGN KEY ("setlist_id") REFERENCES "public"."setlists"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rehearsals"
    ADD CONSTRAINT "rehearsals_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rehearsals"
    ADD CONSTRAINT "rehearsals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."request_comments"
    ADD CONSTRAINT "request_comments_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."request_comments"
    ADD CONSTRAINT "request_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."request_votes"
    ADD CONSTRAINT "request_votes_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."request_votes"
    ADD CONSTRAINT "request_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."requests"
    ADD CONSTRAINT "requests_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."requests"
    ADD CONSTRAINT "requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."requests"
    ADD CONSTRAINT "requests_related_setlist_id_fkey" FOREIGN KEY ("related_setlist_id") REFERENCES "public"."setlists"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."requests"
    ADD CONSTRAINT "requests_related_show_id_fkey" FOREIGN KEY ("related_show_id") REFERENCES "public"."shows"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."requests"
    ADD CONSTRAINT "requests_related_song_id_fkey" FOREIGN KEY ("related_song_id") REFERENCES "public"."songs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."requests"
    ADD CONSTRAINT "requests_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."setlists"
    ADD CONSTRAINT "setlists_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."setlists"
    ADD CONSTRAINT "setlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shows"
    ADD CONSTRAINT "shows_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shows"
    ADD CONSTRAINT "shows_setlist_id_fkey" FOREIGN KEY ("setlist_id") REFERENCES "public"."setlists"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shows"
    ADD CONSTRAINT "shows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."song_sheet_music"
    ADD CONSTRAINT "song_sheet_music_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_sheet_music_preferences"
    ADD CONSTRAINT "user_sheet_music_preferences_sheet_music_id_fkey" FOREIGN KEY ("sheet_music_id") REFERENCES "public"."song_sheet_music"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_sheet_music_preferences"
    ADD CONSTRAINT "user_sheet_music_preferences_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_sheet_music_preferences"
    ADD CONSTRAINT "user_sheet_music_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Authenticated users can create invitations" ON "public"."band_invitations" FOR INSERT WITH CHECK (("invited_by" = "auth"."uid"()));



CREATE POLICY "Band members can create performance sessions" ON "public"."performance_sessions" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."band_members"
  WHERE (("band_members"."band_id" = "performance_sessions"."band_id") AND ("band_members"."user_id" = "auth"."uid"())))) AND ("host_user_id" = "auth"."uid"())));



CREATE POLICY "Band members can create rehearsals" ON "public"."rehearsals" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."band_members"
  WHERE (("band_members"."band_id" = "rehearsals"."band_id") AND ("band_members"."user_id" = "auth"."uid"()) AND ("band_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"]))))));



CREATE POLICY "Band members can create request comments" ON "public"."request_comments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."requests" "r"
     JOIN "public"."band_members" "bm" ON (("bm"."band_id" = "r"."band_id")))
  WHERE (("r"."id" = "request_comments"."request_id") AND ("bm"."user_id" = "auth"."uid"()) AND ("bm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"]))))));



CREATE POLICY "Band members can create requests" ON "public"."requests" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."band_members"
  WHERE (("band_members"."band_id" = "requests"."band_id") AND ("band_members"."user_id" = "auth"."uid"()) AND ("band_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"]))))));



CREATE POLICY "Band members can create setlists" ON "public"."setlists" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."band_members" "bm"
  WHERE (("bm"."band_id" = "setlists"."band_id") AND ("bm"."user_id" = "auth"."uid"()) AND ("bm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"]))))));



CREATE POLICY "Band members can create shows" ON "public"."shows" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."band_members"
  WHERE (("band_members"."band_id" = "shows"."band_id") AND ("band_members"."user_id" = "auth"."uid"()) AND ("band_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"]))))));



CREATE POLICY "Band members can create songs" ON "public"."songs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."band_members" "bm"
  WHERE (("bm"."band_id" = "songs"."band_id") AND ("bm"."user_id" = "auth"."uid"()) AND ("bm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"]))))));



CREATE POLICY "Band members can delete rehearsals" ON "public"."rehearsals" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."band_members"
  WHERE (("band_members"."band_id" = "rehearsals"."band_id") AND ("band_members"."user_id" = "auth"."uid"()) AND (("band_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])) OR ("rehearsals"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Band members can delete requests" ON "public"."requests" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."band_members"
  WHERE (("band_members"."band_id" = "requests"."band_id") AND ("band_members"."user_id" = "auth"."uid"()) AND (("band_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])) OR ("requests"."created_by" = "auth"."uid"()))))));



CREATE POLICY "Band members can delete setlists" ON "public"."setlists" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."band_members" "bm"
  WHERE (("bm"."band_id" = "setlists"."band_id") AND ("bm"."user_id" = "auth"."uid"()) AND (("bm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])) OR (("bm"."role" = 'member'::"text") AND ("setlists"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Band members can delete shows" ON "public"."shows" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."band_members"
  WHERE (("band_members"."band_id" = "shows"."band_id") AND ("band_members"."user_id" = "auth"."uid"()) AND (("band_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])) OR ("shows"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Band members can delete songs" ON "public"."songs" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."band_members" "bm"
  WHERE (("bm"."band_id" = "songs"."band_id") AND ("bm"."user_id" = "auth"."uid"()) AND (("bm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])) OR (("bm"."role" = 'member'::"text") AND ("songs"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Band members can update rehearsals" ON "public"."rehearsals" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."band_members"
  WHERE (("band_members"."band_id" = "rehearsals"."band_id") AND ("band_members"."user_id" = "auth"."uid"()) AND (("band_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])) OR ("rehearsals"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Band members can update requests" ON "public"."requests" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."band_members"
  WHERE (("band_members"."band_id" = "requests"."band_id") AND ("band_members"."user_id" = "auth"."uid"()) AND (("band_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])) OR ("requests"."created_by" = "auth"."uid"()))))));



CREATE POLICY "Band members can update setlists" ON "public"."setlists" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."band_members" "bm"
  WHERE (("bm"."band_id" = "setlists"."band_id") AND ("bm"."user_id" = "auth"."uid"()) AND ("bm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."band_members" "bm"
  WHERE (("bm"."band_id" = "setlists"."band_id") AND ("bm"."user_id" = "auth"."uid"()) AND ("bm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"]))))));



CREATE POLICY "Band members can update shows" ON "public"."shows" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."band_members"
  WHERE (("band_members"."band_id" = "shows"."band_id") AND ("band_members"."user_id" = "auth"."uid"()) AND (("band_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])) OR ("shows"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Band members can update songs" ON "public"."songs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."band_members" "bm"
  WHERE (("bm"."band_id" = "songs"."band_id") AND ("bm"."user_id" = "auth"."uid"()) AND ("bm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"]))))));



CREATE POLICY "Band members can view band setlists" ON "public"."setlists" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."band_members" "bm"
  WHERE (("bm"."band_id" = "setlists"."band_id") AND ("bm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Band members can view band songs" ON "public"."songs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."band_members" "bm"
  WHERE (("bm"."band_id" = "songs"."band_id") AND ("bm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Band members can view performance sessions" ON "public"."performance_sessions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."band_members"
  WHERE (("band_members"."band_id" = "performance_sessions"."band_id") AND ("band_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Band members can view rehearsals" ON "public"."rehearsals" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."band_members"
  WHERE (("band_members"."band_id" = "rehearsals"."band_id") AND ("band_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Band members can view request comments" ON "public"."request_comments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."requests" "r"
     JOIN "public"."band_members" "bm" ON (("bm"."band_id" = "r"."band_id")))
  WHERE (("r"."id" = "request_comments"."request_id") AND ("bm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Band members can view request votes" ON "public"."request_votes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."requests" "r"
     JOIN "public"."band_members" "bm" ON (("bm"."band_id" = "r"."band_id")))
  WHERE (("r"."id" = "request_votes"."request_id") AND ("bm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Band members can view requests" ON "public"."requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."band_members"
  WHERE (("band_members"."band_id" = "requests"."band_id") AND ("band_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Band members can view shows" ON "public"."shows" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."band_members"
  WHERE (("band_members"."band_id" = "shows"."band_id") AND ("band_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Band members can vote on requests" ON "public"."request_votes" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."requests" "r"
     JOIN "public"."band_members" "bm" ON (("bm"."band_id" = "r"."band_id")))
  WHERE (("r"."id" = "request_votes"."request_id") AND ("bm"."user_id" = "auth"."uid"()) AND ("bm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"]))))));



CREATE POLICY "Band owners can delete bands" ON "public"."bands" FOR DELETE USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "Band owners can view invitations" ON "public"."band_invitations" FOR SELECT USING (("invited_by" = "auth"."uid"()));



CREATE POLICY "Host can delete performance session" ON "public"."performance_sessions" FOR DELETE USING (("host_user_id" = "auth"."uid"()));



CREATE POLICY "Host can update performance session" ON "public"."performance_sessions" FOR UPDATE USING (("host_user_id" = "auth"."uid"()));



CREATE POLICY "Owners and admins can update band details" ON "public"."bands" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."band_members" "bm"
  WHERE (("bm"."band_id" = "bands"."id") AND ("bm"."user_id" = "auth"."uid"()) AND ("bm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Users can create bands" ON "public"."bands" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can create calendar subscriptions" ON "public"."calendar_subscriptions" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."band_members"
  WHERE (("band_members"."band_id" = "calendar_subscriptions"."band_id") AND ("band_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can create setlists" ON "public"."setlists" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."bands"
  WHERE (("bands"."id" = "setlists"."band_id") AND ("bands"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "Users can create songs for their bands" ON "public"."songs" FOR INSERT WITH CHECK (("band_id" IN ( SELECT "bands"."id"
   FROM "public"."bands"
  WHERE ("bands"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own calendar subscriptions" ON "public"."calendar_subscriptions" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own vote" ON "public"."request_votes" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete request comments" ON "public"."request_comments" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."requests" "r"
     JOIN "public"."band_members" "bm" ON (("bm"."band_id" = "r"."band_id")))
  WHERE (("r"."id" = "request_comments"."request_id") AND ("bm"."user_id" = "auth"."uid"()) AND ("bm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



CREATE POLICY "Users can delete sheet music for editable bands" ON "public"."song_sheet_music" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."songs" "s"
     JOIN "public"."band_members" "bm" ON (("bm"."band_id" = "s"."band_id")))
  WHERE (("s"."id" = "song_sheet_music"."song_id") AND ("bm"."user_id" = "auth"."uid"()) AND ("bm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"]))))));



CREATE POLICY "Users can delete their band songs" ON "public"."songs" FOR DELETE USING (("band_id" IN ( SELECT "bands"."id"
   FROM "public"."bands"
  WHERE ("bands"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete their own invitations" ON "public"."band_invitations" FOR DELETE USING (("invited_by" = "auth"."uid"()));



CREATE POLICY "Users can delete their setlists" ON "public"."setlists" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their sheet music preferences" ON "public"."user_sheet_music_preferences" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert sheet music for editable bands" ON "public"."song_sheet_music" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."songs" "s"
     JOIN "public"."band_members" "bm" ON (("bm"."band_id" = "s"."band_id")))
  WHERE (("s"."id" = "song_sheet_music"."song_id") AND ("bm"."user_id" = "auth"."uid"()) AND ("bm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"]))))));



CREATE POLICY "Users can insert their sheet music preferences" ON "public"."user_sheet_music_preferences" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."song_sheet_music" "sm"
  WHERE (("sm"."id" = "user_sheet_music_preferences"."sheet_music_id") AND ("sm"."song_id" = "user_sheet_music_preferences"."song_id"))))));



CREATE POLICY "Users can update invitations" ON "public"."band_invitations" FOR UPDATE USING ((("invited_by" = "auth"."uid"()) OR ("email" = "public"."get_current_user_email"())));



CREATE POLICY "Users can update own calendar subscriptions" ON "public"."calendar_subscriptions" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."band_members"
  WHERE (("band_members"."band_id" = "calendar_subscriptions"."band_id") AND ("band_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can update own comments" ON "public"."request_comments" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own vote" ON "public"."request_votes" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update sheet music for editable bands" ON "public"."song_sheet_music" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."songs" "s"
     JOIN "public"."band_members" "bm" ON (("bm"."band_id" = "s"."band_id")))
  WHERE (("s"."id" = "song_sheet_music"."song_id") AND ("bm"."user_id" = "auth"."uid"()) AND ("bm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"]))))));



CREATE POLICY "Users can update their band songs" ON "public"."songs" FOR UPDATE USING (("band_id" IN ( SELECT "bands"."id"
   FROM "public"."bands"
  WHERE ("bands"."owner_id" = "auth"."uid"())))) WITH CHECK (("band_id" IN ( SELECT "bands"."id"
   FROM "public"."bands"
  WHERE ("bands"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can update their setlists" ON "public"."setlists" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their sheet music preferences" ON "public"."user_sheet_music_preferences" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."song_sheet_music" "sm"
  WHERE (("sm"."id" = "user_sheet_music_preferences"."sheet_music_id") AND ("sm"."song_id" = "user_sheet_music_preferences"."song_id"))))));



CREATE POLICY "Users can view bands they are members of or invited to" ON "public"."bands" FOR SELECT USING ((("owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."band_members" "bm"
  WHERE (("bm"."band_id" = "bands"."id") AND ("bm"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."band_invitations" "bi"
  WHERE (("bi"."band_id" = "bands"."id") AND ("bi"."email" = "public"."get_current_user_email"()) AND ("bi"."status" = 'pending'::"text"))))));



CREATE POLICY "Users can view own calendar subscriptions" ON "public"."calendar_subscriptions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view sheet music for their bands" ON "public"."song_sheet_music" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."songs" "s"
     JOIN "public"."band_members" "bm" ON (("bm"."band_id" = "s"."band_id")))
  WHERE (("s"."id" = "song_sheet_music"."song_id") AND ("bm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their band songs" ON "public"."songs" FOR SELECT USING (("band_id" IN ( SELECT "bands"."id"
   FROM "public"."bands"
  WHERE ("bands"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own invitations" ON "public"."band_invitations" FOR SELECT USING (("email" = "public"."get_current_user_email"()));



CREATE POLICY "Users can view their sheet music preferences" ON "public"."user_sheet_music_preferences" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."band_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bands" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calendar_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."performance_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rehearsals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."request_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."request_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."setlists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."song_sheet_music" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."songs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_sheet_music_preferences" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_performance_sessions"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_performance_sessions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_performance_sessions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."expire_guest_memberships"() TO "anon";
GRANT ALL ON FUNCTION "public"."expire_guest_memberships"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."expire_guest_memberships"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_session_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_session_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_session_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_band_members_with_emails"("band_id_param" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_band_members_with_emails"("band_id_param" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_band_members_with_emails"("band_id_param" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_band_role"("band_id_param" bigint, "user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_band_role"("band_id_param" bigint, "user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_band_role"("band_id_param" bigint, "user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_user_email"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_user_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_user_email"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_request_vote_count"("request_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_request_vote_count"("request_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_request_vote_count"("request_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_display_name"("user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_display_name"("user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_display_name"("user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_band_member"("band_id_param" bigint, "user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_band_member"("band_id_param" bigint, "user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_band_member"("band_id_param" bigint, "user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_band_owner"("band_id_param" bigint, "user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_band_owner"("band_id_param" bigint, "user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_band_owner"("band_id_param" bigint, "user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."transfer_band_ownership"("p_band_id" bigint, "p_new_owner_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."transfer_band_ownership"("p_band_id" bigint, "p_new_owner_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transfer_band_ownership"("p_band_id" bigint, "p_new_owner_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_calendar_subscriptions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_calendar_subscriptions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_calendar_subscriptions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_performance_sessions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_performance_sessions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_performance_sessions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_rehearsals_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_rehearsals_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_rehearsals_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_request_comments_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_request_comments_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_request_comments_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_requests_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_requests_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_requests_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_shows_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_shows_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_shows_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."band_invitations" TO "anon";
GRANT ALL ON TABLE "public"."band_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."band_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."band_members" TO "anon";
GRANT ALL ON TABLE "public"."band_members" TO "authenticated";
GRANT ALL ON TABLE "public"."band_members" TO "service_role";



GRANT ALL ON TABLE "public"."bands" TO "anon";
GRANT ALL ON TABLE "public"."bands" TO "authenticated";
GRANT ALL ON TABLE "public"."bands" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bands_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bands_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bands_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."calendar_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."performance_sessions" TO "anon";
GRANT ALL ON TABLE "public"."performance_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."performance_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."rehearsals" TO "anon";
GRANT ALL ON TABLE "public"."rehearsals" TO "authenticated";
GRANT ALL ON TABLE "public"."rehearsals" TO "service_role";



GRANT ALL ON TABLE "public"."request_comments" TO "anon";
GRANT ALL ON TABLE "public"."request_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."request_comments" TO "service_role";



GRANT ALL ON TABLE "public"."request_votes" TO "anon";
GRANT ALL ON TABLE "public"."request_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."request_votes" TO "service_role";



GRANT ALL ON TABLE "public"."requests" TO "anon";
GRANT ALL ON TABLE "public"."requests" TO "authenticated";
GRANT ALL ON TABLE "public"."requests" TO "service_role";



GRANT ALL ON TABLE "public"."setlists" TO "anon";
GRANT ALL ON TABLE "public"."setlists" TO "authenticated";
GRANT ALL ON TABLE "public"."setlists" TO "service_role";



GRANT ALL ON TABLE "public"."shows" TO "anon";
GRANT ALL ON TABLE "public"."shows" TO "authenticated";
GRANT ALL ON TABLE "public"."shows" TO "service_role";



GRANT ALL ON TABLE "public"."song_sheet_music" TO "anon";
GRANT ALL ON TABLE "public"."song_sheet_music" TO "authenticated";
GRANT ALL ON TABLE "public"."song_sheet_music" TO "service_role";



GRANT ALL ON TABLE "public"."songs" TO "anon";
GRANT ALL ON TABLE "public"."songs" TO "authenticated";
GRANT ALL ON TABLE "public"."songs" TO "service_role";



GRANT ALL ON TABLE "public"."user_sheet_music_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_sheet_music_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_sheet_music_preferences" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";









-- ============================================================================
-- Outside `public` (not covered by `db dump --schema public`)
-- ============================================================================

-- Realtime: performance sync subscribes to performance_sessions
-- (migrations/PERFORMANCE_SESSIONS_MIGRATION.sql).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.performance_sessions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- Storage: the sheet-music bucket (migrations/SHEET_MUSIC_MIGRATION.sql).
-- band-avatars is created by 20260627134532_band_avatar_and_ownership.sql.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('sheet-music', 'sheet-music', false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies of the sheet-music bucket, as dumped from production
-- (`supabase db dump --linked --schema storage`).
DROP POLICY IF EXISTS "Users can delete sheet music for editable bands" ON "storage"."objects";
DROP POLICY IF EXISTS "Users can update sheet music for editable bands" ON "storage"."objects";
DROP POLICY IF EXISTS "Users can upload sheet music for their bands" ON "storage"."objects";
DROP POLICY IF EXISTS "Users can view sheet music from their bands" ON "storage"."objects";

CREATE POLICY "Users can delete sheet music for editable bands" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'sheet-music'::"text") AND (("storage"."foldername"("name"))[1] IN ( SELECT ("band_members"."band_id")::"text" AS "band_id"
   FROM "public"."band_members"
  WHERE (("band_members"."user_id" = "auth"."uid"()) AND ("band_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"])))))));

CREATE POLICY "Users can update sheet music for editable bands" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'sheet-music'::"text") AND (("storage"."foldername"("name"))[1] IN ( SELECT ("band_members"."band_id")::"text" AS "band_id"
   FROM "public"."band_members"
  WHERE (("band_members"."user_id" = "auth"."uid"()) AND ("band_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"])))))));

CREATE POLICY "Users can upload sheet music for their bands" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'sheet-music'::"text") AND (("storage"."foldername"("name"))[1] IN ( SELECT ("band_members"."band_id")::"text" AS "band_id"
   FROM "public"."band_members"
  WHERE ("band_members"."user_id" = "auth"."uid"())))));

CREATE POLICY "Users can view sheet music from their bands" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'sheet-music'::"text") AND (("storage"."foldername"("name"))[1] IN ( SELECT ("band_members"."band_id")::"text" AS "band_id"
   FROM "public"."band_members"
  WHERE ("band_members"."user_id" = "auth"."uid"())))));

