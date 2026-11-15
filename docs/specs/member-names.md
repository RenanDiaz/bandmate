# Spec: Member names and nicknames

> **Status:** implemented (PR 1.1), manual validation pending ·
> **Created:** 2026-11-15 · **Owner:** Renán Díaz
> **Origin:** "me parece un poco tedioso nombrarlos siempre por su correo"
> and "dentro de las bandas nos identificamos más fácilmente por apodo que
> por nombre … que el owner se los pueda asignar, y que cada miembro pueda
> cambiar el suyo propio".
> **Scope:** show people by name instead of email, a per-band nickname
> (owner sets anyone's, each member their own), a name for email-and-password
> accounts. One phase, one PR.

## 1. Decisions

1. **One rule for what a person is called in a band:** nickname → name →
   email. Name is `full_name`, else `name`, from `auth.users`
   `raw_user_meta_data` (Google fills both; 11 of the 16 members on
   2026-11-15). `memberDisplayName()` (`src/utils/memberNames.ts`) is the
   client side, `get_band_member_names()` the server side.
2. **The nickname belongs to the membership** (`band_members.nickname`), not
   the account: one person can be "Chino" in one band and "Carlos" in
   another, and the owner who assigns it is the band's.
3. **Who sets it:** the band's owner for any member, each member for
   themselves. One SECURITY DEFINER RPC, `set_band_member_nickname()`,
   checks it (`band_members` has no RLS, so the function is the gate). Up
   to 40 characters, trimmed; empty clears it.
4. **Email accounts get a name** from the account menu ("Your name"),
   stored with `auth.updateUser({ data: { full_name } })`, the key Google
   uses, so every place that reads names picks it up. Google accounts don't
   get the field: Google rewrites `full_name` on each sign-in.
5. **The email stays visible where it matters:** under the name in the
   member list (the owner needs it to tell accounts apart) and in the
   account menu. Confirmations ("Remove …?") use the display name.
6. **Photos:** the member list shows the Google photo (`avatar_url`) when
   there is one, else initials of the display name.
7. **Security fix on the way:** `get_band_members_with_emails` returned any
   band's members and emails to anyone with the anon key. It now returns
   rows only to a member of that band. The new RPCs check the same, and
   execute only for `authenticated`.

## 2. Acceptance criteria

- **AC1** The member list shows each member by display name, the email
  smaller below, and the Google photo when there is one.
- **AC2** The owner can set or clear any member's nickname from their row;
  a member can set or clear their own; nobody else sees the action.
- **AC3** The RPC refuses a nickname change by a non-owner for someone else
  (42501), and one over 40 characters.
- **AC4** Request authors and commenters, and the sync host, appear by
  their display name in that band.
- **AC5** The account menu shows the user's name above the email. An email
  account can set "Your name"; a Google account doesn't see the action.
- **AC6** A non-member calling `get_band_members_with_emails` for a band
  gets no rows.
- **AC7** All new strings in `en.json` and `es.json`.

## 3. Design

- **Migration** `20261117120000_member_nicknames.sql`: `band_members.nickname
  text` (CHECK 1–40 chars); `get_band_members_with_emails` recreated with a
  `nickname` column and the membership check; `set_band_member_nickname
  (band_id, user_id, nickname)`; `get_band_member_names(band_id, user_ids[])`
  → `(user_id, display_name)`, nickname → name → email for members, name
  only for people no longer in the band.
- **Services:** `bandMembersService.setMemberNickname()`,
  `getBandMemberNames()` (one call instead of one `get_user_display_name`
  per person; falls back to it if the RPC is missing);
  `requestsService` and `performanceSessionService` use it with the band.
- **UI:** `BandMembers` rows (name, email, photo, "Edit nickname" →
  `NicknameModal`); `AuthButton` (name + email, "Your name" →
  `AccountNameModal` for email accounts, session and online only);
  `TransferOwnershipModal` uses `memberDisplayName`.

## 4. Phases and PRs

### Phase 1 — Names and nicknames

**Goal:** people are called by nickname or name everywhere in a band.
**Closes:** AC1–AC7. **Validate (manual):** AC1, AC2, AC4, AC5 in the app
after `supabase db push --remote`; AC3 and AC6 with a second account.

- **PR 1.1:** migration, services, UI, strings, tests.

## 5. Not in scope

- `get_user_display_name` still answers the anon key with any user's name
  or email (used for invitation senders); tightening it is a follow-up.
- Nicknames in push notification texts: they name the actor by
  `actorDisplayName()` (name, else the email's local part) in the
  `send-push-notifications` Edge Function. Using the band's nickname there
  is a follow-up that needs a function deploy.
