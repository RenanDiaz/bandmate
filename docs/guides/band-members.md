# Band members & invitations

How multi-user bands work: roles, the security model, and the invitation flow.

## Roles

`BandRole = "owner" | "admin" | "member" | "guest"` (`src/services/bandMembersService.ts`).

| Action | Owner | Admin | Member | Guest |
|--------|-------|-------|--------|-------|
| View band / songs / setlists | ✅ | ✅ | ✅ | ✅ |
| Create, edit and delete songs and setlists — any row, regardless of creator (`canEditContent`) | ✅ | ✅ | ✅ | ❌ |
| Create, edit, delete, complete and cancel shows and rehearsals — any row, regardless of creator (`canManageEvents`) | ✅ | ✅ | ✅ | ❌ |
| Band settings (`canManageBandSettings`) | ✅ | ✅ | ❌ | ❌ |
| Invite and manage members (`canManageMembers`) | ✅ | ❌ | ❌ | ❌ |

- The creator of a band is its owner.
- Invitations offer **member** or **guest**. The owner can later promote a member to
  **admin** from the members list.
- Guest invitations carry `expires_in_days: 30`; other invitations expire after 7 days.

### Why ownership is not a permission

The song library, setlists and calendar belong to the band, not to whoever typed
them in. Owner, admin and member can edit and delete any song, setlist, show or
rehearsal of their band; `user_id` on those rows is kept for attribution and
reports only. The service checks, the UI gating and the RLS UPDATE/DELETE
policies all follow this rule. Owners who want read-only collaborators use the
guest role. Details and rationale:
[docs/specs/content-permissions.md](../specs/content-permissions.md).

## Security model: `band_members` has no RLS

`band_members` is the join table every other policy depends on (`bands`, `songs`,
`setlists`… check membership through it). Policies on `band_members` itself caused
infinite recursion — the policy queried `band_members` (or `bands`, whose policy
queries `band_members` again). The fix, applied in
`migrations/BAND_MEMBERS_MIGRATION_V3.sql`, was to **disable RLS on
`band_members`** and enforce access in the app:

- every function in `bandMembersService` checks the current user and role first;
- the other tables keep RLS, written against `band_members`.

Consequence: **every role check in the UI and services matters.** Don't drop one
assuming the database will catch it, and don't re-enable RLS on `band_members`.
`band_invitations` keeps RLS enabled.

## Invitation flow

### Sending (owner)

Band Settings → Members → **Invite Member**: email + role. `createBandInvitation()`

1. inserts a `band_invitations` row with a random `token` (`crypto.randomUUID()`)
   and `expires_at`;
2. calls the `send-invitation-email` Edge Function (Resend). A failed email does
   **not** fail the invitation: the result reports `emailSent` / `emailError` and
   the UI tells the owner to share the link by hand.

Email setup: [../setup/email-sending.md](../setup/email-sending.md).

The **Pending Invitations** section of the members list shows email, role, expiry,
a copy-link button and **Revoke** (`revokeInvitation`).

### Accepting (invitee)

- **By link** — `/invite/accept?token=…` (`AcceptInvitation.tsx`) validates the
  token with `getInvitationByToken()`, shows the details, and accepts or declines.
- **From the home page** — when logged in with the invited email,
  `PendingInvitations.tsx` lists `getMyInvitations()` with inline accept/decline.

`acceptInvitation()` adds the user to `band_members` with the invited role and
marks the invitation `accepted`, so a token works once. Expired, revoked or
declined invitations can't be accepted.

### Service functions

| Function | Purpose |
|----------|---------|
| `getBandMembers`, `getUserBandRole` | Read members / current user's role |
| `updateMemberRole`, `removeBandMember`, `leaveBand` | Manage membership |
| `createBandInvitation`, `getBandInvitations`, `revokeInvitation` | Owner side |
| `getMyInvitations`, `getInvitationByToken`, `acceptInvitation`, `declineInvitation` | Invitee side |

## Tables

**`band_members`** — `id`, `band_id`, `user_id`, `role`, `invited_by`, `joined_at`,
`expires_at` (guests), `created_at`.

**`band_invitations`** — `id`, `band_id`, `email`, `role`, `invited_by`,
`status` (`pending | accepted | declined | expired`), `token`, `expires_at`,
`created_at`, `updated_at`.

## Manual test checklist

With two accounts (owner + invitee):

- [ ] Owner sends a member invitation and a guest invitation; both appear under
      Pending Invitations; the email arrives (or the UI explains it didn't).
- [ ] Copy link → open in the invitee's session → accept → the band appears in
      their band list with the right role badge.
- [ ] Decline from the home page removes the invitation.
- [ ] Revoked and expired invitations can't be accepted; an invalid token shows an error.
- [ ] Owner changes a role (member ↔ guest ↔ admin) and removes a member.
- [ ] A non-owner can leave the band.
- [ ] Guest: read-only everywhere, no Band Settings. Member: can edit songs and
      setlists, no Band Settings. Admin: Band Settings, but can't manage members.
- [ ] `/bands/{id}/settings` for a band you don't belong to is denied.
