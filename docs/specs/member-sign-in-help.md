# Spec: Email a member how to sign in

> **Status:** Phase 1 implemented (PR 1.1), manual validation (AC6–AC8,
> needs the function deployed) pending · **Created:** 2026-11-07 ·
> **Owner:** Renán Díaz
> **Origin:** request "un botón para cada miembro en la lista de miembros
> para enviarle un correo para que entre a Bandmate, porque no recuerdan
> cómo se entra y me toca escribirles el link por WhatsApp".
> **Scope:** one button per member in the band's member list, an Edge
> Function that sends the email, a log table for the rate limit. One phase,
> one PR.

## 1. Decisions

1. **The point is *how*, not just the link.** People forget which account
   and which button they used. The function reads the recipient's sign-in
   methods from `auth.users.app_metadata` (`providers`, else `provider`) and
   the email names them: "Tap «Continue with Google» and pick the Google
   account ana@gmail.com" / "Sign in with your email … and your password".
   Several methods → all of them; none known → "the same option you used
   the first time". The recipient's address and providers never reach the
   client.
2. **Owner only**, like every other member action (role matrix: "Manage
   members"). The owner sees the button on every member's row except their
   own. The Edge Function re-checks it: `band_members` has no RLS, so the
   function's check is the only gate. Widening it to admins is one line in
   the UI and one in the function.
3. **Confirm before sending** (`ConfirmModal`, `tone="primary"`): an email
   leaves the app, and the button sits next to Remove.
4. **Link = `APP_URL/login`.** No `?band=`: the login flow doesn't carry it
   through OAuth, and a member with one band lands in it anyway.
5. **Language = the sender's UI language** (`i18n.language`). We don't store
   the recipient's language for users without a push subscription; a band
   usually shares one.
6. **Rate limit per recipient, across bands:** one email per 10 minutes and
   three per 24 hours (`member_sign_in_help_emails`). It protects the
   recipient's inbox (and the Resend quota) from repeated taps or several
   owners; 429 `too-soon` carries `retryAfterSeconds` and the UI says how
   many minutes to wait.
7. **Same sender as invitations** (`Bandmate <invitations@bandmate.space>`,
   Resend, `RESEND_API_KEY` + `APP_URL`): no new secret, no new domain.
8. **Texts live in the function**, both languages, in
   `_shared/signInHelp.ts` (dependency-free, unit-tested), like the push
   texts. Every interpolated value is HTML-escaped (band and user names are
   user input).

## 2. Acceptance criteria

- **AC1** As owner, each member row except mine has an envelope button
  "Email how to sign in"; admins, members and guests don't see it.
- **AC2** Tapping it opens a confirmation naming the member; Cancel sends
  nothing.
- **AC3** Confirming sends the email and shows "Email sent to …".
- **AC4** A second send to the same person within 10 minutes (or a fourth in
  24 h) is refused with "… You can send another in N min."
- **AC5** The function refuses (403) a caller who isn't the band's owner, a
  recipient who isn't in the band (404) and sending to yourself (403),
  whatever the request body says.
- **AC6** A member who signed up with Google gets an email naming «Continue
  with Google» and their Google address; an email/password member gets the
  email + password line.
- **AC7** The email's button opens `/login` of the deployed app.
- **AC8** The email reads correctly in Gmail (web + mobile) in English and
  Spanish.

## 3. Design

| Piece | Where |
|-------|-------|
| Email texts, methods, quota (pure) | `supabase/functions/_shared/signInHelp.ts` → `src/lib/__tests__/signInHelp.test.ts` |
| Edge Function | `supabase/functions/send-sign-in-help/index.ts` (JWT verified; service role) |
| Log table | `supabase/migrations/20261107120000_member_sign_in_help_emails.sql` (RLS on, no policies) |
| Client call | `sendSignInHelpEmail(bandId, memberUserId, locale)` in `bandMembersService.ts`, never throws, returns a `SignInHelpResult` |
| Button + confirm + feedback | `BandMembers.tsx` → `src/components/__tests__/BandMembersSignInHelp.test.tsx` |

Function contract: `POST { bandId, memberUserId, locale? }` →
`{ sent: true }`, or `{ error }` with 400 `invalid-request`, 401
`not-authenticated`, 403 `forbidden`, 404 `member-not-found`, 422
`no-email`, 429 `too-soon` (+ `retryAfterSeconds`), 500 `not-configured`,
502 `send-failed`. The log row is written after Resend accepts the email.

## 4. Phases and PRs

### Phase 1 — Sign-in help email

**Goal:** the owner sends a member, from the member list, an email that
says how to get into Bandmate, instead of writing it on WhatsApp.
**Closes:** AC1–AC8.
**Validate (manual):** apply the migration (`supabase db push`), deploy
`supabase functions deploy send-sign-in-help`, then AC1–AC4 from band
settings, AC5 with a crafted request (another band's id, a non-member's
id), AC6–AC8 with a Google account and an email/password account.

- **PR 1.1** — everything in §3, with unit tests.

## 5. Not in scope (possible follow-ups)

- Showing "last signed in" per member in the list (would need an RPC that
  exposes `auth.users.last_sign_in_at` to the owner).
- A magic link (one-tap sign-in): Supabase supports it, but it would add a
  third sign-in method and change the auth flow.
- Re-sending a pending invitation's email from the invitations list (today
  it only copies the link).
- The same email for admins, or a self-service "email me how I sign in" on
  the login page.
