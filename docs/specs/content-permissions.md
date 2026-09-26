# Spec: Content permissions — align RLS, services and UI with the role matrix

> **Status:** draft · **Created:** 2026-09-26 · **Owner:** Renán Díaz
> **Origin:** TODO "Revisar los permisos para modificar canciones, playlists y
> shows por parte de otros miembros de la banda, cualquiera con suficiente
> privilegio debería poder editar y eliminar."
> **Scope:** songs, setlists, shows, rehearsals. One migration, small service
> changes, role-gated UI. One PR.

This is a design, not code. SQL and signatures are given because they are the
contract; no bodies are written here.

## 0. The problem

The app has three layers that decide who may edit or delete content, and they
disagree. The role matrix in `CLAUDE.md` and
[docs/guides/band-members.md](../guides/band-members.md) says owner, admin and
**member** can create and edit songs, setlists, shows and rehearsals; guests are
read-only. The service layer implements exactly that (`canEditContent`,
`canManageEvents` in `src/services/bandMembersService.ts`, checked before every
update/delete in `songsService`, `setlistsService`, `showsService`,
`rehearsalsService`). The RLS policies do not:

| Table | INSERT | UPDATE | DELETE | Policy file (legacy, applied by hand) |
|-------|--------|--------|--------|----------------------------------------|
| `songs` | owner/admin/member | owner/admin/member | owner/admin; **member only own rows** | `migrations/FIX_BAND_ROLE_PERMISSIONS.sql` |
| `setlists` | owner/admin/member | owner/admin/member (+ `WITH CHECK`) | owner/admin; **member only own rows** | `migrations/FIX_SETLIST_UPDATE_POLICY.sql` |
| `shows` | owner/admin/member | owner/admin; **any member only own rows** | owner/admin; **any member only own rows** | `migrations/SHOWS_MIGRATION.sql` |
| `rehearsals` | owner/admin/member | owner/admin; **any member only own rows** | owner/admin; **any member only own rows** | `migrations/REHEARSALS_MIGRATION.sql` |
| `song_sheet_music` | owner/admin/member | owner/admin/member | owner/admin/member | `migrations/SHEET_MUSIC_MIGRATION.sql` — already aligned |

"Own rows" means `<table>.user_id = auth.uid()`. Note the `shows` and
`rehearsals` policies do not even check the role for the own-row branch: a
**guest** who somehow owned a row could update it (guests cannot insert, so
today this is only reachable through a role downgrade).

What a user sees today (member, acting on a row created by someone else):

- **Delete a song or setlist:** the service check passes, the `DELETE` hits
  RLS, RLS filters the row out, PostgREST returns success with zero rows, the
  list reloads and the item is still there. **Silent no-op**, no toast.
- **Edit or delete a show or rehearsal:** same for delete (silent). For edit,
  `.update().select().single()` gets zero rows, PostgREST answers `PGRST116`,
  the view toasts the generic "update error". Wrong message, no way to know
  it is a permission problem.
- **Guest:** `SongList`, `ShowList`, `SetlistList` and `RehearsalList` default
  `canEdit = true` and the views never pass the role, so guests see Edit and
  Delete, the New forms, Import and the AI generator; every action then fails
  in the service with a thrown error → generic error toast.
- **Detail views:** `ShowDetailView` and `RehearsalDetailView` show Delete,
  Mark completed and Cancel to every role.

Also: no delete in any service verifies that a row was affected, so any
future RLS drift will again fail silently. The `songs` UPDATE policy has no
`WITH CHECK`, so a member could in principle move a song to another band by
updating `band_id` (the setlists policy fixed this; songs did not get the fix).

## 1. Decision: the role matrix is the source of truth

Owner, admin and member can **create, edit and delete any** song, setlist, show
or rehearsal of their band, regardless of who created it. Guest is read-only.
Ownership (`user_id`) is kept as a fact (attribution, reports) but is **not** a
permission input for these four tables.

Rationale: the documented matrix and the service layer already say this; the
product is a shared band library, not per-user content; the legacy policies
are the odd one out and are the ones users report as bugs. "Members can only
delete their own" was never a product decision — it was the default of the
first migration that later fixes did not fully revisit.

If this decision is flipped ("members may only delete their own rows"), the
change is the opposite direction: keep the policies, make `canEditContent` /
`canManageEvents` take the row's `user_id`, and pass it through the lists.
This spec does not cover that path.

Unchanged and out of scope:

- `requests`, `request_comments`, `request_votes` (approve/reject is
  owner/admin; comments and votes are per user). `canCreateRequests` already
  excludes guests, and the request actions in `SongList` live inside the
  role-gated dropdown, which is the right place.
- `performance_sessions` (host-only update/delete).
- `bands`, `band_members`, `band_invitations` (see the guide: `band_members`
  has no RLS on purpose; nothing here touches it).
- `song_sheet_music` and the storage bucket policies — already aligned.
- Anything a band owner can do to members' roles.

## 2. Permission matrix after this PR

| Action | Owner | Admin | Member | Guest | Helper |
|--------|-------|-------|--------|-------|--------|
| View songs / setlists / shows / rehearsals | ✅ | ✅ | ✅ | ✅ | — |
| Create, edit, **delete any** song or setlist | ✅ | ✅ | ✅ | ❌ | `canEditContent` |
| Upload, reorder, delete sheet music | ✅ | ✅ | ✅ | ❌ | `canEditContent` |
| Create, edit, **delete any** show or rehearsal, mark completed / cancelled | ✅ | ✅ | ✅ | ❌ | `canManageEvents` |
| Band settings | ✅ | ✅ | ❌ | ❌ | `canManageBandSettings` |
| Manage members | ✅ | ❌ | ❌ | ❌ | `canManageMembers` |

`canEditContent` and `canManageEvents` keep the same body today (owner, admin,
member). They stay as two functions: they name two product concepts and may
diverge later (e.g. a "booker" role). Nothing new is added to
`bandMembersService`.

## 3. Database: one migration

File: `supabase/migrations/20260927120000_align_content_rls_with_roles.sql`
(CLI flow, `supabase db push`). Idempotent: every statement is
`DROP POLICY IF EXISTS` + `CREATE POLICY`. It must not assume anything about
the base schema beyond the four tables, their `band_id` and `user_id`
columns, and `band_members(band_id, user_id, role)` — the base schema is not
versioned in this repo.

Every UPDATE and DELETE policy on the four tables becomes the same predicate,
role-only:

```sql
EXISTS (
  SELECT 1 FROM band_members bm
  WHERE bm.band_id = <table>.band_id
    AND bm.user_id = auth.uid()
    AND bm.role IN ('owner', 'admin', 'member')
)
```

Per table, dropping every legacy name that may exist (names from the legacy
files; some databases have the older ones):

| Table | DROP (all of) | CREATE |
|-------|----------------|--------|
| `songs` | `"Band members can update songs"`, `"Band members can delete songs"`, `"Band owners and song creators can delete songs"` | `"Band members can update songs"` (USING + **WITH CHECK**), `"Band members can delete songs"` |
| `setlists` | `"Band members can update setlists"`, `"Band members can delete setlists"`, `"Band owners and setlist creators can delete setlists"` | `"Band members can update setlists"` (USING + WITH CHECK, as today), `"Band members can delete setlists"` |
| `shows` | `"Band members can update shows"`, `"Band members can delete shows"` | same names, USING + WITH CHECK / USING |
| `rehearsals` | `"Band members can update rehearsals"`, `"Band members can delete rehearsals"` | same names, USING + WITH CHECK / USING |

Rules:

- `WITH CHECK` on every UPDATE policy uses the same predicate, so a row cannot
  be moved to a band where the user has no edit role.
- INSERT and SELECT policies are **not** touched (already correct).
- No `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` — RLS is already on; adding it
  is harmless but the migration should say in a comment that it assumes it.
- The migration ends with a `DO $$ ... RAISE NOTICE` listing the four tables
  it changed, in the style of `FIX_SETLIST_UPDATE_POLICY.sql`, so the person
  applying it by hand sees it ran.

`migrations/README.md` gets a note under "Supporting Functions & Fixes" that
the UPDATE/DELETE policies in `FIX_BAND_ROLE_PERMISSIONS.sql`,
`FIX_SETLIST_UPDATE_POLICY.sql`, `SHOWS_MIGRATION.sql` and
`REHEARSALS_MIGRATION.sql` are superseded by this migration (they are kept
for history; a fresh setup runs them and then `supabase db push`).

## 4. Service layer: fail loudly on a filtered row

The role checks before each write stay exactly as they are (they give the
readable "You don't have permission…" error before touching the network, and
they are the only guard on `band_members`, which has no RLS). Two additions:

**4.1 Affected-row check on delete.** Every `delete*` in the four services
selects the deleted id and throws when nothing came back:

```ts
const { data, error } = await supabase
  .from("songs")
  .delete()
  .eq("id", songId)
  .select("id");
if (error) throw error;
if (!data || data.length === 0) throw new PermissionError("songs.delete");
```

Functions: `deleteSong`, `deleteSetlist`, `deleteShow`, `deleteRehearsal`.
Updates already fail (via `.single()` → `PGRST116`) and need no change beyond
4.2.

**4.2 One error type.** `src/services/permissionError.ts`:

```ts
export class PermissionError extends Error {
  readonly name = "PermissionError";
  constructor(readonly action: string) { … }
}
export function isPermissionError(e: unknown): e is PermissionError;
/** PGRST116 on an update/delete `.single()` is a filtered row, i.e. a permission problem. */
export function isRowFilteredError(e: unknown): boolean;
```

The existing `throw new Error("You don't have permission to …")` sites in the
four services (and `sheetMusicStorageService`) become `throw new
PermissionError("<table>.<verb>")`. Message text is not user-facing: views
translate.

**4.3 Views show the right toast.** Where a view catches an update/delete
error (`SongsView`, `SetlistsView`, `SetlistDetailView`, `SetlistEditor`,
`ShowsView`, `ShowDetailView`, `RehearsalsView`, `RehearsalDetailView`,
`EditSongModal`, `EditShowModal`, `EditRehearsalModal`, `EditSetlistModal`),
`isPermissionError(e) || isRowFilteredError(e)` toasts
`t("common.noPermission")` ("You don't have permission to do that in this
band" / "No tienes permiso para hacer eso en esta banda"); everything else
keeps today's toast. After the migration this path is a safety net, not the
normal flow — but it is what turns the next RLS drift into a visible bug.

## 5. UI: gate by role, one way

The role comes from `selectedBand.user_role` (`useBandContext()`, loaded with
the bands). Views derive one boolean from the helpers — never a bare
`!== "guest"` comparison:

```ts
const canEdit = canEditContent(selectedBand?.user_role ?? null);      // songs, setlists
const canManage = canManageEvents(selectedBand?.user_role ?? null);   // shows, rehearsals
```

| View | Passes / hides |
|------|----------------|
| `SongsView` | `canEdit` → `SongList`; hides `NewSongForm`, the Import button/modal and the "Add" area for guests |
| `SetlistsView` | `canEdit` → `SetlistList`; hides `NewSetlistForm` and `AISetlistGenerator` for guests |
| `SetlistDetailView`, `SetlistEditor` | replace `user_role !== "guest"` with `canEditContent(...)`; unchanged behaviour |
| `ShowsView` | `canManage` → `ShowList`; hides `NewShowForm` for guests |
| `ShowDetailView` | Delete, Mark completed, Cancel and the Edit entry only when `canManage`. Add-to-calendar and the linked setlist stay for everyone |
| `RehearsalsView` | `canManage` → `RehearsalList`; hides `NewRehearsalForm` for guests |
| `RehearsalDetailView` | same as `ShowDetailView` |

`SongList`, `ShowList`, `SetlistList`, `RehearsalList` keep their `canEdit`
prop but **drop the `= true` default**: a list rendered without the prop hides
the actions. Every current call site passes it explicitly (the four views
above), so nothing else changes. (Default-true is how the guest bug slipped
in; a required prop makes the next list author decide.)

What guests keep: view everything, expand songs, transpose is **hidden**
(it writes `transposition` through `updateSong`, which guests cannot do),
print, perform, offline copies (A7 in the offline spec: every role), calendar
export, request actions where `canCreateRequests` allows.

No `user_role` → treated as guest (the helpers return `false` for `null`).
`user_role` is undefined only while bands load or for a stale band; a
read-only flash is the safe direction.

## 6. Acceptance criteria

Roles below are on the same band; "another user's" means a row whose
`user_id` is not the acting user. `[DB]` is verified in SQL against a Supabase
project after `supabase db push` (manual checklist §7.2), `[UI]` in the dev
server with two accounts, `[unit]` by Vitest.

**Database**

- AC1 `[DB]` As **member**, `DELETE FROM songs WHERE id = <another user's song>`
  removes the row. Same for `setlists`, `shows`, `rehearsals`.
- AC2 `[DB]` As **member**, `UPDATE shows SET name = … WHERE id = <another
  user's show>` changes the row. Same for `rehearsals`.
- AC3 `[DB]` As **guest**, UPDATE and DELETE on any row of the four tables
  affect 0 rows (RLS filters; no error). INSERT is rejected (unchanged).
- AC4 `[DB]` As **member**, `UPDATE songs SET band_id = <band where I am
  guest or not a member>` fails with an RLS `WITH CHECK` violation. Same for
  the other three tables.
- AC5 `[DB]` A user who is **not a member** of the band cannot read, update or
  delete its rows (unchanged; re-verified).
- AC6 `[DB]` Running the migration twice succeeds (idempotent) and leaves
  exactly one UPDATE and one DELETE policy per table with the names in §3
  (`select policyname, cmd from pg_policies where tablename in (…)`).
- AC7 `[DB]` Existing rows are untouched: no data migration, `user_id` values
  unchanged.

**Services**

- AC8 `[unit]` `deleteSong`, `deleteSetlist`, `deleteShow`, `deleteRehearsal`
  throw `PermissionError` when the mocked delete returns zero rows, and resolve
  when it returns the id.
- AC9 `[unit]` Each of those, plus the corresponding `update*`, throws
  `PermissionError` **before** any table write when `getUserBandRole` resolves
  `"guest"` or `null` (the Supabase mock records no `update`/`delete` call).
- AC10 `[unit]` `isRowFilteredError` is true for an error object with
  `code: "PGRST116"` and false for other errors.
- AC11 `[unit]` `canEditContent` / `canManageEvents`: true for owner, admin,
  member; false for guest and `null` (existing behaviour, now covered).

**UI**

- AC12 `[UI]` As **member**, Edit and Delete on another user's song, setlist,
  show and rehearsal succeed from the list and from the detail view; the list
  reflects the change without a manual reload; no error toast.
- AC13 `[UI]` As **member**, Mark completed / Cancel on another user's show
  and rehearsal succeed.
- AC14 `[UI]` As **guest**: no Edit/Delete dropdown in `SongList`, no
  transpose buttons, no `NewSongForm`, no Import, no `NewSetlistForm`, no AI
  generator, no Edit/Delete in `SetlistList`, `ShowList`, `RehearsalList`, no
  Delete / Mark completed / Cancel / Edit in `ShowDetailView` and
  `RehearsalDetailView`. Perform, print, offline download, add-to-calendar and
  the request actions the guest is allowed remain.
- AC15 `[UI]` As **guest**, navigating straight to `/setlists/:id/edit` behaves
  as today (`canEditSongs` false in the editor); no new route gating is added
  by this PR.
- AC16 `[UI]` If a write is refused anyway (simulate by pointing the app at a
  database without the migration, or by mocking), the toast is
  `common.noPermission` in the current language, not the generic error.
- AC17 `[UI]` `npm run lint`, `npm run build`, `npm test` pass; new strings
  exist in `en.json` and `es.json`.

**Docs**

- AC18 `CLAUDE.md` "Role Permissions" table gains the rows "Delete songs /
  setlists (any)" and "Create/edit/delete shows and rehearsals (any)", with
  Member ✅; the "Database Schema Notes" note on `band_members` is unchanged.
- AC19 `docs/guides/band-members.md` matrix says "any row, regardless of
  creator" for the content rows, and a short "Why ownership is not a
  permission" paragraph links to this spec.
- AC20 `migrations/README.md` notes which legacy policies the new migration
  supersedes (§3). `docs/README.md` and the README "Documentation" list link
  this spec.

## 7. Tests

### 7.1 Unit (Vitest)

- `src/services/__tests__/permissionError.test.ts` — AC10.
- `src/services/__tests__/contentPermissions.test.ts` — AC8, AC9, AC11, with
  `getUserBandRole` mocked per case and the `supabaseClient` mock from
  `src/test/setup.ts` extended with a chainable `from().delete().eq().select()`
  that returns what the test sets.
- `src/components/__tests__/SongsViewRoles.test.tsx` (jsdom, `renderApp`
  with `bandContext({ selectedBand: { …, user_role: "guest" } })`): the Edit
  dropdown, transpose buttons, `NewSongForm` and Import are absent for a guest
  and present for a member — AC14 for the song page; the other lists get the
  same two-case test in one file each, or one parametrised file. Keep them to
  presence/absence: the service mocks are never called.

The RLS policies cannot be unit-tested here (no local Postgres in CI). They
are covered by §7.2 and the PR description states which project they were
checked on.

### 7.2 Manual checklist (two accounts, one band: owner + invitee)

Run in the dev server against a project where the migration was pushed.
Record it in the PR description.

- [ ] Owner creates a song, a setlist, a show and a rehearsal.
- [ ] Invitee as **member**: edits and deletes each of the four (AC12, AC13).
- [ ] Owner re-creates them; invitee as **member** uploads sheet music to the
      owner's song and deletes it (already allowed; regression).
- [ ] Owner changes invitee to **guest**: invitee reloads and sees no write
      actions on any list or detail (AC14); Perform, print and offline
      download still work; transpose buttons are gone.
- [ ] Guest opens `/setlists/:id/edit` directly: song edit is disabled as
      today (AC15).
- [ ] Owner changes invitee back to **member**: actions return after reload.
- [ ] SQL editor as the member (`set request.jwt.claim.sub`, or the
      Supabase "run as" impersonation): AC1–AC4, AC6.
- [ ] `npm run build` has no new console errors in the flows above.

## 8. Rollout and risk

- **Order:** merge the PR, then `supabase db push` on production. Between the
  two, nothing breaks: the UI gating and the loud-error path work against the
  old policies (members get `common.noPermission` instead of a silent no-op
  for the minutes the migration is pending — strictly better).
- **Reversal:** re-running the legacy files restores the old policies; the
  app then shows `common.noPermission` where members hit them. No data risk:
  the migration touches policies only.
- **Blast radius:** a member can now delete any song, setlist, show or
  rehearsal of the band. That is the product decision (§1). Owners who want
  read-only collaborators have the guest role. There is no soft delete or
  undo in the app today; this PR does not add one.
- **Offline (Phase 2 spec):** `performanceCapabilities` already denies
  reorder/upload/notes to guests and everything offline; unchanged. The
  snapshot writes (`patchSnapshotSetlist`) go server-first through
  `updateSetlist`, so they inherit §4.

## 9. Files touched (expected)

```
supabase/migrations/20260927120000_align_content_rls_with_roles.sql   new
src/services/permissionError.ts                                       new
src/services/songsService.ts, setlistsService.ts, showsService.ts,
  rehearsalsService.ts, sheetMusicStorageService.ts                   PermissionError, row check
src/components/SongsView.tsx, SetlistsView.tsx, ShowsView.tsx,
  RehearsalsView.tsx, ShowDetailView.tsx, RehearsalDetailView.tsx,
  SetlistDetailView.tsx, SetlistEditor.tsx                            role gating, toast
src/components/SongList.tsx, SetlistList.tsx, ShowList.tsx,
  RehearsalList.tsx                                                   canEdit required
src/components/Edit{Song,Show,Rehearsal,Setlist}Modal.tsx             toast
src/i18n/locales/en.json, es.json                                     common.noPermission
src/services/__tests__/…, src/components/__tests__/…                  §7.1
CLAUDE.md, docs/guides/band-members.md, migrations/README.md,
  docs/README.md, README.md                                           §6 Docs
```

Definition of done: the `CLAUDE.md` checklist, plus §7.2 recorded in the PR
description with the project it was run against, plus "RLS: policies checked"
naming the eight policies of §3.
