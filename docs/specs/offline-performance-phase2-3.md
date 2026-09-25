# Spec: Offline performance mode — Phases 2 and 3

> **Status:** draft · **Created:** 2026-09-24 · **Owner:** Renán Díaz
> **Intent:** [docs/intents/offline-performance.md](../intents/offline-performance.md)
> **Scope:** Phase 2 (snapshot + performance mode offline) and Phase 3 (update
> check and management). Phase 1 (local pdf.js worker, offline-safe auth,
> `networkTimeoutSeconds`) is assumed merged; §1 says exactly what that must
> mean. Phase 4 (backing tracks) is out.

This is a design, not code. Type declarations and function signatures are
given because they are the contract between PRs; no bodies are written here.

## Changelog

- **2026-09-25 — PR 2.2b: download engine (decisions the spec did not cover).**
  - **Scope moved to 2.4:** `refreshSnapshotRows`, `patchSnapshotSetlist`,
    `patchSnapshotPreference` and the post-commit row refresh of §4.3 ship
    with their only caller, the snapshot source. Nothing renders a snapshot
    before 2.4, so a resumed download's older rows are refreshed before
    anyone sees them. §12 updated.
  - **Valid session vs. cached user.** `setOfflineCurrentUser(userId,
    { authenticated })`: `true` only in `authMode: "session"`. Reads keep
    filtering by `userId` alone; plan, download and resume require
    `authenticated` (§5.4 `not-authenticated`).
  - **Race 1 — wipe during a download.** `meta` gains an optional `epoch`
    (random, replaced by every clear: `wipeAll`, schema wipe). Every write of a
    download runs in one transaction that first reads `meta.epoch` and aborts,
    writing nothing, when it differs from the epoch the download started with.
    IDB serializes readwrite transactions on the store **across tabs**, so a
    wipe either committed before (refused) or runs after (and clears it). A
    wipe in this tab also aborts the in-flight fetch at once, and the job
    compares a wipe counter taken when it was claimed, so a wipe landing
    before the job has read the epoch is caught too. Chosen over an in-memory
    generation because another tab's sign-out must count. `epoch` is optional
    and additive (a pre-2.2b meta reads as `null`), so no schema bump.
  - **Race 2 — auth drops mid-download.** Fetching needs a signed URL, so
    before **each file fetch** the owner must still be the `authenticated`
    current user and `navigator.onLine` must not be `false`. If not, the
    remaining files are recorded as `network` in the journal and the result
    is `failed` (`offline` for the same uid without a valid session or a
    browser that says offline, `not-authenticated` otherwise); the journal
    stays for resume. The gate reads `navigator.onLine` only, never the
    context's `isOnline` (whose 30 s forced-offline window after one failed
    request would skip every remaining file): a single file failing on the
    network records `network` and the next file is still tried.
    **The commit is local and needs neither network nor a session:** only an
    unchanged epoch and the plan's owner as the current uid (checked inside
    the commit transaction). So a download that fetched every file and then
    lost signal, or went `offline-cached`, still commits; `session-lost`
    (current uid `null`) or another uid commits nothing. Likewise
    `resumeInterruptedDownloads()` needs only the owner as current user: a
    journal whose files are all stored commits offline; one with files left to
    fetch waits for a valid session and the browser online. The snapshot's
    `userId` is always the plan's owner.
  - **Race 3 — GC during a download.** `collectGarbage()` is one readwrite
    transaction (keys, every `snapshot:` and `download:` record, deletes,
    `lastGcAt`), so it cannot interleave with a download's writes in any tab;
    it also keeps the paths of this tab's running job. The one window left,
    a file counted as present at plan time and GC'd before the journal
    exists, is closed by re-checking presence right after the journal is
    written (from then on the journal protects it); a missing one is fetched.
  - **Race 4 — one download per device.** An in-tab claim taken before the
    first `await`, plus a Web Lock (`navigator.locks.request(
    "bandmate-offline-download", { ifAvailable: true })`) held for the whole
    download or resume; busy → `download-in-progress`. Without Web Locks
    (Safari < 15.4) only the in-tab claim applies; two tabs could then both
    download, which stays consistent (per-file transactions, per-setlist
    journal) but may compete for quota. A resume re-reads its journal once it
    holds the lock and skips it if another tab finished or replaced it.
  - **Atomicity, tightened (§4.3).** A stored file and its journal outcome are
    written in one transaction (not `set` then rewrite). The commit writes
    meta + snapshot + band **and deletes the journal** in one transaction, and
    checks inside it that every referenced file is present (§3.5 #5); `bytes`
    and `fileCount` count what is actually stored.
  - **Quota ceiling (§4.5).** After a file fails on quota, a later file is
    tried only if it is smaller than the smallest file that failed so far
    (known size, `Content-Length`, or the fetched size); larger ones are
    `quota` without being stored (without being fetched when the size is
    known). Reads §4.5 #3 as a ceiling rather than "stop at the first larger
    file", so small PDFs later in the setlist still fit.
  - **Plan.** The rows fetched at plan time live in memory next to the plan
    (a `DownloadPlan` not returned by `planDownload()` on this page is
    `plan-stale`). Signed URLs are created per file at download time (600 s),
    so a slow download never outlives its URLs. `incremental` is accepted and
    ignored until PR 3.3 (a full plan already fetches only missing files). A
    setlist's band not in `getMyBands()` is `setlist-not-found`.
  - **Cancel** runs GC right away (§4.6 lists it; §4.4's "GC at the next app
    start" is superseded), so cancelled files do not linger. With no download
    running, `cancelDownload(id)` discards that setlist's interrupted journal
    (PR 3.4's Discard).
  - **Persistence.** `navigator.storage.persist()` is asked once, when the
    first download starts (the confirm tap is the user gesture), not awaited
    (Firefox prompts); the answer is recorded in `meta.persisted`.
  - **Also:** the fingerprint (§6.1) is computed at commit already (song
    timestamps `""` until §6.2); a re-download keeps the snapshot's
    `localPreferenceOverrides`; `removeSnapshot` deletes `band:{id}` with the
    last snapshot of any user that names it; the 60 s stall timer covers the
    wait for headers and each body chunk, not a total time.
  - **Dev hook.** `window.__bandmateOffline` (plan/download/list/usage/
    resume/cancel/remove/GC) exists only under `import.meta.env.DEV`; the
    production bundle has no reference to it.

- **2026-09-26 — 2.2a follow-ups (fixes, no new features).**
  - **A6 amended: the race runs whenever `last-user` exists, online or
    not.** Weak signal and captive portals report `navigator.onLine` true, and
    there `getSession()` also takes ≈25 s. After 1.5 s the provisional
    `offline-cached` state applies exactly as offline (no side effects; the late
    answer reconciles). With a valid token `getSession()` answers in ≈0 ms, so
    online sign-ins are unchanged. The captive-portal residual risk in §7.1/§11
    shrinks to "no `last-user` on the device". §7.1, §11.
  - **§7.2 weak signal.** With `authMode: "session"`, only a **network**
    failure of `getMyBands()` (`isNetworkError`, `src/lib/networkErrors.ts`)
    falls back to `listOfflineBands()` and calls `reportNetworkFailure()`; an
    HTTP error (401, RLS, 5xx) keeps the no-band UI with no fallback. The logic
    lives in `src/context/bandResolution.ts`. `getMyBands(userId)` now takes the
    uid from `BandContext` instead of calling `getSession()` again, which could
    wait ≈25 s with a token near expiry.
  - **User sign-out always ends signed out locally.** auth-js 2.70
    `signOut()` (any scope, `"local"` included, which still POSTs
    `/logout`) returns `{ error }` on a network failure **without** removing the
    stored session. `signOutEverywhereOrLocally()` (`src/lib/authSession.ts`)
    removes it locally (auth-js `_removeSession()`) when offline, on a network
    error, or after 3 s. An HTTP error is surfaced and the user stays signed in
    (the wipe already ran). §3.5 #6a.
  - **`AppUser`** is `{ id } & Partial<Omit<User, "id">>`: every field but `id`
    is optional, so the compiler enforces the `offline-cached` case.
    `AuthButton` reads `user`/`authMode` from the context (no second
    `getSession()`); in `offline-cached` it shows "Offline" with no email.
  - **Schema-wipe notice: `dismissedBy` removed.** By A1 the store holds one
    user's data at a time, so dismissing removes the current user's entries and
    the key is deleted when `lost` is empty. Entries keep their `userId` for the
    failed-wipe case (old records linger until the wipe is retried). No notice
    can exist in production yet (the schema version was never bumped), so no
    migration. `wipeAll()` already deleted the notice (it clears the store); a
    test now pins it. §3.2, §3.3, §5.1.

- **2026-09-25 — PR 2.2 split into 2.2a and 2.2b.** PR 2.2 carried the store,
  the offline auth rework and the whole download engine; reviewed as one it
  mixed the riskiest auth change with the largest new code. §12 now has:
  - **2.2a — Offline store, reads, offline auth** (depends on 2.0):
    `idb-keyval`; `offlineStore.ts` (key layout, open, schema guard, wipe that
    records the A4 lost list); the service's reads, owner filter, events,
    `confirmSignedInUser` / `wipeAll`, `countHiddenSnapshots` and the
    schema-wipe notice accessors; `BandContext` auth modes (A1/A6), `last-user`
    and the `listOfflineBands` branch; `performPosition.ts` key prefix +
    `clearAllPerformPositions` only (read/write stay in 2.4); vitest +
    fake-indexeddb and `npm test`.
  - **2.2b — Download engine** (depends on 2.2a): `planDownload`,
    `downloadSetlist`, journal/resume, quota handling, GC,
    `requestPersistence`, `removeSnapshot`, `listInterruptedDownloads`,
    `getStorageUsage`, `refreshSnapshotRows` and `patchSnapshot*`.
  - 2.3 now depends on 2.2b. The acceptance-criteria map assigns C1–C2,
    C4–C7 and the A9 recording to 2.2a; nothing in §10 is checked by 2.2b
    alone (its criteria A1–A8 are exercised through 2.3's UI), so 2.2b is
    verified by unit tests against fake-indexeddb.
  - Implementation note from 2.2a: the §7.1 resolution lives in
    `src/context/offlineAuthController.ts` (plain TypeScript, unit-tested);
    `BandContext` mirrors its state. `user` in `offline-cached` is an
    `OfflineUser` (`{ id, offlineCached: true }`), and the context's `user` type
    is `AppUser = User | OfflineUser`.

- **2026-09-25 — PR 2.1 reconciliation.** §8.1 now matches what shipped:
  - `selectSheetMusic`: the network source still toasts
    `sheetMusic.preferenceError` when the server write fails (kept in 2.1,
    no behaviour change). The "never toasts" rule applies to the snapshot
    source (PR 2.4).
  - `capabilities` are computed in 2.1 but not enforced. The view had no guest
    gating before (Reorder and Add PDF were visible to guests); PR 2.4 gates on
    them together with the offline gating.
  - Sources open a **session** that emits full-row replacements (the A3
    background refresh and write-through share one channel), with two rules:
    unchanged parts keep reference identity, and the view never reseeds its
    local items while in reorder mode.
  - `resolvePdfUrl` is cancellable; the source returns `ResolvedPdf.release`
    (blob URL revoke in 2.4).
  - A failed sheet-music prefetch marks the session stale;
    `retryStaleSheetMusic` retries on song change and on entering the sheet
    music view.

- **2026-09-25 — PR 2.0 additions + A6.**
  - **Precache guard** (PR 2.0). The main bundle is ≈2.0 MB, ~81 KB under
    Workbox's 2 MiB `maximumFileSizeToCacheInBytes` default; a file above it
    is left out of the precache and the app cannot start offline. The limit
    goes to 5 MiB, and `scripts/check-precache.mjs`, run by `npm run build`,
    fails the build if any `.js`/`.mjs`/`.css`/`.html` in `dist/` is missing
    from the manifest (the `globPatterns`/`globIgnores` case is otherwise
    silent). Code-splitting is a follow-up. §8.4, §12.
  - **Self-hosted font** (PR 2.0). Space Grotesk (700, the only weight used)
    comes from `@fontsource/space-grotesk` instead of Google Fonts, and
    `woff2` joins `globPatterns` so it and Bootstrap Icons are precached: the
    shell looks the same offline. §8.4, §12.
  - **Worker registration** (PR 2.0, found while implementing C4). In
    `prompt` mode `virtual:pwa-register` still reloads a tab on `controlling`
    once its prompt has fired, so accepting the update in one tab would reload
    another tab that is performing. `PwaReloadPrompt` registers the worker
    with `workbox-window` directly (`injectRegister: false`); a worker
    activated from elsewhere only raises the prompt. §8.4.
  - **A6** Offline, `BandContext` does not wait on `getSession()`: Phase 1
    measured ≈25.4 s for it to resolve `null` with a token inside the refresh
    margin or expired, which is the normal case on show day. It races a
    ≈1.5 s timeout and resolves provisionally from `last-user`, then
    reconciles by the A1 rules. §1, §7.1, §10 (new C7), §12 (PR 2.2, now 2.2a).

- **2026-09-25 — Amendments A1–A5 + minor.**
  - **A1** Never auto-wipe on an ambiguous auth state. `wipeAll()` runs only
    on user-initiated sign-out and on a confirmed sign-in with a different
    uid. A lost session or an involuntary `SIGNED_OUT` **hides** snapshots
    instead (new `authMode: "session-lost"`). §3.3, §3.5 #1/#6, §5.1, §5.4,
    §7.1, §10 (C1–C2 + new C4–C6), §11, §12.
  - **A2** Performance position persisted in `localStorage` (not
    `sessionStorage`) so it survives an app kill; 12 h expiry; removed by
    `wipeAll()`. §3.3, §3.5 #6, §9.4, §10 B7, §11, §12.
  - **A3** Snapshot stays the primary source online, but **rows refresh
    automatically whenever online**; only files follow notify-don't-download.
    "Outdated" now means "files are missing or changed". Perform-mode writes
    patch the snapshot. §3.2, §4.1, §5.2–5.3, §6.1, §6.3–6.4, §8.1–8.3, §10
    (B10, D, E, new B11–B13), §11, §12; intent *Decisions*.
  - **A4** A schema-version wipe records what was lost and shows a one-time
    "download these again" notice. §3.1, §3.3, §3.5 #2, §5.1, §5.5, §7.3,
    §10 (new A9), §12 (PR 2.6).
  - **A5** Offline user/band resolution moves out of PR 2.5: PR 2.0 fixes the
    infinite spinner on its own; PR 2.2 adds `last-user`, `offline-cached` and
    the `listOfflineBands` branch. §1, §7, §12.
  - **Minor** `DownloadPlan.bytesUnknown` → `filesWithUnknownSize`.
  - **Also changed to stay consistent:** `skipped-present` keys on storage
    path only and `OfflineFileRecord.rowUpdatedAt` is dropped (§3.2, §4.1),
    because A3's row refresh would otherwise make every renamed PDF look like
    a new file. New findings C11 and C12 in §0 record the code facts behind A1
    and A3.

---

## 0. Where the code contradicts the intent

Findings from reading the code on 2026-09-24. Each one changes the plan below;
the intent should be amended where noted.

| # | Intent says | Code says | Consequence |
|---|-------------|-----------|-------------|
| C1 | Fingerprint compares "the referenced songs" (§2b). | `songs` has **no `updated_at`** column exposed (`Song` in `songsService.ts` has only `created_at`; `updateSong` writes no timestamp). The base schema is unversioned, so this must be verified on the live DB, but nothing in the repo adds it. | Song edits (lyrics, chords, key, timing) are undetectable by timestamp. Phase 3 starts with a migration adding `songs.updated_at` + the existing `update_updated_at_column()` trigger (§6.2, PR 3.0). |
| C2 | Offline, "resolve the user from the locally stored session (`getSession()`)… an expired token offline still allows opening snapshots" (§3). | `getSession()` in auth-js 2.70 refreshes when `expires_at` is within 90 s; a refresh that fails on a network error returns `{ session: null }` (`GoTrueClient.__loadSession`). Supabase access tokens expire after 1 h by default. | After more than an hour in airplane mode `getSession()` alone yields no user. The app must persist a `lastKnownUserId` (`last-user`) whenever a valid session is established and use it when the refresh fails on the network (§7.1). If Phase 1 did not ship this, it is a Phase 2 prerequisite. |
| C3 | Phase 1 makes auth offline-safe and the shell survives (§3). | `BandContext` calls `getMyBands()` with **no error path**: on rejection `isResolvingBand` never becomes `false`, and `App.tsx:324` renders a spinner while `user && isResolvingBand`. Even with a user, offline the app is a spinner forever. `selectedBand.user_role` also drives `canEditSongs`. | The snapshot must store the **full `Band` row** (including `user_role`), not just name/avatar, and `BandContext` needs an offline branch that resolves `bands`/`selectedBand` locally (§7.2). |
| C4 | "What already works: the app shell is precached." Risk list does not mention SW updates. | `VitePWA({ registerType: 'autoUpdate' })` generates a worker with `skipWaiting` + `clientsClaim`, and `registerSW` in auto mode calls `window.location.reload()` on `activated` with `isUpdate` (`vite-plugin-pwa/dist/client/build/register.js:41`). `PwaReloadPrompt`'s `onNeedRefresh` is never invoked in this mode, so the banner is dead code. | A deploy during a show plus a moment of signal can reload the page mid-song. Switch to `registerType: 'prompt'` so the existing banner does its job (§8.3, PR 2.0). |
| C5 | §4: offline PDF selection "is saved to the server next time we are online, best effort". §Out of scope: "any write queue". | `handleSelectSheetMusic` (`SetlistPerformanceView.tsx:619`) writes to the server immediately and **toasts an error on failure**. | Offline, every PDF switch would show an error toast. This spec keeps one tiny, explicitly bounded write: preference overrides live in the snapshot and are flushed once, best effort, next time performance mode opens online (§5.6). Nothing else is queued. Amend the intent's out-of-scope line to say so. |
| C6 | Phase 2 "Done when #2": open the app offline, "go to that setlist and perform it". §5 puts the "Offline setlists" list in Phase 3. | `Home`, `SetlistsView` and `SetlistDetailView` all fetch on mount with no offline path; `SetlistDetailView` and the performance view both `navigate("/setlists")` on load failure. Offline, there is no way to *reach* a snapshot. | A minimal offline setlist list moves into **Phase 2** (§7.3). Phase 3 keeps the management view (sizes, refresh, remove). |
| C7 | Show total size before downloading (§1). | `song_sheet_music` has **no size column**; `SheetMusic` exposes none. | Size comes from `storage.from('sheet-music').list('{bandId}/{songId}')` at plan time, one request per song, in parallel (§4.2). No schema change. |
| C8 | Finding #6: the Workbox cache is keyed by URL and ignores auth. | The `supabase-api` NetworkFirst rule matches **every** `*.supabase.co` request, including signed-URL PDF GETs (`statuses: [0, 200]`). Downloading a PDF through the SW copies up to 50 MB into that cache too. | Narrow the rule to `/rest/v1/` and `/auth/v1/` (or exclude `/storage/v1/`) so PDF bytes are stored exactly once, in the snapshot (§8.4, PR 2.0). |
| C9 | §2: performance mode reads through one entry point. | `usePerformanceSync` calls `getUserBandRole` and `getActiveSessionWithHost` on mount and opens a Realtime channel on join; `subscribeToSession` has no offline guard. | The hook gets an `enabled` flag; offline it does nothing and reports `unavailable` (§5.5). |
| C10 | "No redirect to login" (Done when #2). | No route is guarded. With `user === null` the performance view mounts, `getSetlist` throws "User not authenticated", and the view **bounces to `/setlists`** with an error toast. | The failure mode is a bounce, not a login redirect. Acceptance criteria are phrased against the bounce (§9). |
| C11 | "Signing out deletes all offline data" (Done when #5); sign-out wipe (§5). | auth-js 2.70 emits `SIGNED_OUT` from `_removeSession()`, which also runs when a token refresh fails with a **non-retryable** error (`_callRefreshToken`, `_recoverAndRefresh`). A retryable network error keeps the stored session and emits nothing. `youtubeService.requestAuthorization()` calls `signOut()` and immediately signs the same user back in. | Wiping on `SIGNED_OUT` would delete everything on a captive portal or when the user connects YouTube. Only `AuthButton.logout` wipes; other sign-outs hide (A1, §3.5, §7.1). Done-when #5 still holds for the user action it describes. |
| C12 | Update check "notify, don't auto-download" covers rows and files alike (§2b). | Performance mode writes reorders (`handleSaveOrder` → `updateSetlist`) and preferences to the server; a snapshot that is not updated keeps rendering the old rows. | Rows refresh automatically online; only files wait for the user (A3, §8.2). Amend the intent's *Decisions*. |

Confirmed consistent with the intent: storage paths are `{bandId}/{songId}/{sheetMusicId}.pdf` and `song_sheet_music.file_url` stores the **path**, not a URL (`SheetMusicUpload.tsx:706`); the bucket is private with a band-membership SELECT policy on `storage.objects`; there is no "replace PDF in place" flow (only create and delete), so a changed file always has a new row id and path; guests can read everything the snapshot needs; the legacy `songs.sheet_music_url` column is read by no view and is ignored here.

---

## 1. What Phase 1 must have delivered

This spec assumes, and PR 2.0 verifies before anything else lands:

1. pdf.js worker served from the app origin and precached (no `unpkg`).
2. `supabase-api` runtime cache has `networkTimeoutSeconds` (3–4 s).
3. `BandContext` obtains the user from `getSession()` first and only falls back
   to `getUser()` when online.
4. **Not** covered by Phase 1 and handled here: `lastKnownUserId` (C2, PR
   2.2), band resolution offline (C3: error path in PR 2.0, local bands in PR
   2.2), SW update mode (C4, PR 2.0), storage-rule narrowing (C8, PR 2.0).

Phase 1 landed on 2026-09-25 (branch `feat/offline-phase1-foundations`).
PR 2.0 still checks items 1–3 above before building on them. Measured then,
as input for PR 2.2: with a token inside the 90 s refresh margin or already
expired, `getSession()` offline retries the refresh 8 times with exponential
backoff and resolves after **≈25 s** (25.4 s measured) with `{ session: null }` and an
`AuthRetryableFetchError`; the stored session is kept. `isCheckingAuth` stays
`true` for that whole time. With a valid token it resolves in ≈0 ms and makes
no request. This is why §7.1 does not wait on `getSession()` offline (A6).

---

## 2. Vocabulary

- **Snapshot** — everything one setlist needs to be performed offline, stored on
  the device under one `setlistId`. Data rows + a list of file references.
- **File** — one PDF blob, stored once per storage path and shared by every
  snapshot that references it.
- **Plan** — the server-side inventory computed before a download: rows to
  store, files to fetch, files already present, files to delete, byte estimate.
- **Fingerprint** — the structured description of "what the server had when
  this snapshot was taken" (§6.1), used by the update check.
- **Row refresh** — refetching a snapshot's data rows (setlist, referenced
  songs, `song_sheet_music`, preferences, band) and committing them to the
  snapshot **without downloading any PDF** (§8.2, §6.3). Automatic whenever
  online.
- **Outdated** — the snapshot's rows are current but it references PDFs that
  are not in the store (added or replaced on the server). Fixed only by the
  user tapping "Update offline copy".
- **Hidden** — snapshots exist on the device but no reads return them,
  because the session was lost without the user signing out (§7.1).
- **Store** — the single IndexedDB database behind `idb-keyval` (§3.3).

---

## 3. Snapshot schema

All types live in `src/services/offlineSetlistService.ts` (public) and
`src/lib/offlineStore.ts` (key layout, private to the service). Components
import only from the service and from hooks.

### 3.1 Versioning

```ts
/** Bump when any stored shape changes. Old versions are wiped, not migrated (§3.5). */
export const OFFLINE_SCHEMA_VERSION = 1 as const;
```

A bump deletes every offline copy on every device the next time the app
opens, so it is never silent: the wipe records which setlists existed and the
UI tells the user to download them again (§3.5 #2, A9). A PR that bumps the
version must say why in its description (CLAUDE.md rule, PR 2.6).

The wipe reads only `snapshot-meta:*` keys to build the notice. Those records
are from an older schema, so the reader relies on nothing but three fields
that every version must keep with the same name and type: `setlistId`,
`setlistName`, `userId` (plus `bandId` when present). This is the one
cross-version contract of the store.

### 3.2 Types

```ts
import type { Band } from "./bandsService";
import type { Setlist } from "./setlistsService";
import type { Song } from "./songsService";
import type { SheetMusic } from "./songSheetMusicService";

/** Written once per device; guards every read. */
export interface OfflineStoreMeta {
  schemaVersion: typeof OFFLINE_SCHEMA_VERSION;
  /** Result of the last navigator.storage.persist() call, or null if never asked. */
  persisted: boolean | null;
  /** ISO timestamp of the last successful garbage collection (§4.6). */
  lastGcAt: string | null;
  /** Replaced by every clear; download writes are refused under another epoch (PR 2.2b, race 1). Optional: absent on pre-2.2b metas. */
  epoch?: string;
}

/** Small record used by lists and badges; never contains rows or blobs. */
export interface OfflineSnapshotMeta {
  schemaVersion: typeof OFFLINE_SCHEMA_VERSION;
  setlistId: string;
  bandId: number;
  /** auth.uid() that downloaded it. Snapshots of another user are invisible (§3.5). */
  userId: string;
  setlistName: string;
  savedAt: string;            // ISO, when the last commit finished
  /** "complete" = every planned file is present; "partial" = some files failed (§4.4). */
  completeness: "complete" | "partial";
  /** Sum of stored file bytes referenced by this snapshot. */
  bytes: number;
  fileCount: number;
  missingFiles: OfflineMissingFile[];
  fingerprint: OfflineFingerprint;
  /**
   * "unknown" until the first successful row refresh after savedAt.
   * "fresh"    = rows current, every referenced file present (or failed: see completeness).
   * "outdated" = rows current, but some referenced files were added/replaced on
   *              the server and are not in the store (missingFiles reason "not-downloaded").
   * "deleted"  = the setlist row is gone on the server (or RLS hides it).
   * Row-only changes never produce "outdated": they are committed by the refresh (A3).
   */
  freshness: "unknown" | "fresh" | "outdated" | "deleted";
  /** Last successful row refresh (Phase 2: perform-mode open; Phase 3: every check). */
  lastCheckedAt: string | null;
  /** When rows were last committed by a refresh or a perform-mode write (≥ savedAt). */
  rowsUpdatedAt: string;
  /** Phase 3: what the last refresh applied and what files it left pending. */
  lastDiff: OfflineDiff | null;
  /** Phase 3: last time every file was read back successfully (§6.5). */
  verifiedAt: string | null;
}

export interface OfflineMissingFile {
  storagePath: string;
  sheetMusicId: string;
  songId: string;
  /**
   * "not-downloaded": referenced by rows that a refresh brought in after the
   * last download (A3). It does not make completeness "partial"; it makes
   * freshness "outdated". Every other reason is a failed download.
   */
  reason: "quota" | "network" | "not-found" | "forbidden" | "unknown" | "not-downloaded";
  bytes: number | null;
}

/** The data performance mode renders from. */
export interface OfflineSnapshot {
  schemaVersion: typeof OFFLINE_SCHEMA_VERSION;
  setlistId: string;
  userId: string;
  band: Band;                                  // full row incl. user_role (C3)
  setlist: Setlist;                            // normalized (ids on special items)
  /** Only the songs referenced by setlist.songs, keyed by song id. */
  songsById: Record<string, Song>;
  /** song_sheet_music rows for those songs, sorted by position, keyed by song id. */
  sheetMusicBySongId: Record<string, SheetMusic[]>;
  /** Files this snapshot references. Presence in the store is not guaranteed (see missingFiles). */
  files: OfflineFileRef[];
  /** user_sheet_music_preferences at download time: song id -> sheet music id. */
  preferredSheetMusicIds: Record<string, string>;
  /** Device-local preferred instrument at download time (may be null). */
  preferredInstrument: string | null;
  /**
   * Preferences chosen while offline, not yet on the server (C5, §5.6).
   * Overrides preferredSheetMusicIds when rendering. Cleared after a flush.
   */
  localPreferenceOverrides: Record<string, string>;
}

export interface OfflineFileRef {
  storagePath: string;        // "{bandId}/{songId}/{sheetMusicId}.pdf" == SheetMusic.file_url
  sheetMusicId: string;
  songId: string;
  /** song_sheet_music.updated_at of the row as last refreshed; part of the fingerprint. Not a file identity. */
  rowUpdatedAt: string;
}

/**
 * Stored once per storage path, shared across snapshots. The path is the file's
 * identity: there is no replace-in-place flow, so bytes at a path never change
 * (§0). Row metadata (name, instrument, timings) lives in the snapshot rows and
 * is refreshed without touching this record (A3).
 */
export interface OfflineFileRecord {
  storagePath: string;
  blob: Blob;                 // type "application/pdf"
  bytes: number;
  downloadedAt: string;
}

/** Written by a schema-mismatch wipe (§3.5 #2); entries are removed as they are dismissed. */
export interface OfflineSchemaWipeNotice {
  wipedAt: string;
  fromVersion: number | null;          // null when meta was missing/unreadable
  toVersion: typeof OFFLINE_SCHEMA_VERSION;
  /**
   * Only this user's entries are ever shown to them (§3.5 #1). No per-user
   * dismissal list: by A1 the store holds one user's data at a time, so
   * dismissing removes entries and the key goes when this is empty.
   */
  lost: Array<{ userId: string; setlistId: string; setlistName: string; bandId: number | null }>;
}

/** Progress of an in-flight or interrupted download (§4). Deleted on commit or cancel. */
export interface OfflineDownloadJournal {
  schemaVersion: typeof OFFLINE_SCHEMA_VERSION;
  setlistId: string;
  userId: string;
  startedAt: string;
  plan: DownloadPlan;
  /** storagePath -> outcome, filled as files finish. */
  outcomes: Record<string, "stored" | "skipped-present" | OfflineMissingFile["reason"]>;
  /** Snapshot rows are fetched at plan time and kept here until commit, so a resume needs no network for data. */
  pendingSnapshot: Omit<OfflineSnapshot, "files"> & { files: OfflineFileRef[] };
}
```

Performance position (A2) is **not** in IndexedDB: it is written on every
song change and must be readable synchronously on mount. It lives in
`localStorage`, handled by `src/lib/performPosition.ts` (no Supabase, so not a
service):

```ts
/** localStorage key: `bandmate_perform_position_{userId}_{setlistId}`. */
export interface PerformPosition {
  currentIndex: number;
  contentView: "chords" | "lyrics" | "sheetMusic";   // same union as SetlistPerformanceView.tsx:222
  selectedSheetMusicId: string | null;
  savedAt: string;                                    // ISO
}

export const PERFORM_POSITION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** null when absent, unparsable, or savedAt older than 12 h (and then removed). */
export function readPerformPosition(userId: string, setlistId: string): PerformPosition | null;
export function writePerformPosition(userId: string, setlistId: string, p: Omit<PerformPosition, "savedAt">): void;
/** Removes every `bandmate_perform_position_*` key. Called by wipeAll(). */
export function clearAllPerformPositions(): void;
```

It applies to every performance-mode session, with or without a snapshot.
`currentIndex` is clamped to the item count on restore (the setlist may have
changed); a `selectedSheetMusicId` that no longer exists falls back to the
preferred PDF.

### 3.3 IndexedDB key layout

One database, one object store, string keys with a type prefix. `idb-keyval`
can only create a store at database version 1, so a second store in the same
database is not an option; prefixes are.

| Key | Value | Notes |
|-----|-------|-------|
| `meta` | `OfflineStoreMeta` | Read on every store open. Missing or wrong `schemaVersion` → wipe (§3.5). |
| `band:{bandId}` | `Band` | Written on every download; read by `BandContext` offline (§7.2). One per band, last download wins. |
| `snapshot-meta:{setlistId}` | `OfflineSnapshotMeta` | The existence of this key with `completeness` set is what "available offline" means. |
| `snapshot:{setlistId}` | `OfflineSnapshot` | Read only by performance mode / offline detail. |
| `file:{storagePath}` | `OfflineFileRecord` | Blob values. Never enumerate with `values()`/`entries()`; use `keys()` and load one at a time. |
| `download:{setlistId}` | `OfflineDownloadJournal` | Present only while a download is in flight or was interrupted. |
| `last-user` | `string` (auth uid) | Written by `BandContext` whenever a **valid session** is established (`SIGNED_IN` / `TOKEN_REFRESHED` / `INITIAL_SESSION` with a session). Removed **only** by `wipeAll()`; an involuntary `SIGNED_OUT` keeps it (A1, §7.1). Lives here rather than `localStorage` so `wipeAll()` covers it. |
| `schema-wipe-notice` | `OfflineSchemaWipeNotice` | Written by the schema-mismatch wipe (§3.5 #2) *after* re-initializing `meta`, so it survives that wipe. Removed by `wipeAll()`, and once its last entry is dismissed. |

Outside IndexedDB, `wipeAll()` also removes the `localStorage` keys
`bandmate_perform_position_*` (A2), because they identify setlists.

Database name `bandmate-offline`, store name `kv`, created with
`idb-keyval`'s `createStore`. The database name includes no user id: user
scoping is by the `userId` field and `last-user` (§3.5).

Blob URLs are never stored. They are created by the hook that hands a PDF to
`SheetMusicViewer` and revoked when the selection changes or the view
unmounts.

### 3.4 Size

Rows are small (a setlist, its songs' text, a few dozen `song_sheet_music`
rows). Files dominate: up to 50 MB each (bucket limit). The `bytes` on
`OfflineSnapshotMeta` counts each referenced file once; the management view
(§6.6) sums *distinct* files across snapshots for the device total.

### 3.5 Invariants

1. **Owner.** Every read filters by `userId === currentUserId`, where
   `currentUserId` is `null` in `authMode: "session-lost"` (§7.1), so hidden
   snapshots are returned by no read. On a **confirmed** sign-in (a valid
   session from `getSession()` or a `SIGNED_IN` event), if `last-user` exists
   and differs from the new uid, `wipeAll()` runs before anything else and
   before any list renders (a shared device changed hands without signing
   out). A missing session is never a confirmed sign-in.
2. **Schema.** If `meta.schemaVersion !== OFFLINE_SCHEMA_VERSION`, or a record
   carries a different version, the whole store is wiped and re-initialized.
   There is no migration path in v1; downloading again is the migration.
   Before clearing, the wipe collects `{ userId, setlistId, setlistName,
   bandId }` from every `snapshot-meta:*` key (§3.1) and, when that list is
   non-empty, writes `schema-wipe-notice` after the new `meta`. The notice is
   shown once per affected user (§7.3, A9). A schema wipe keeps `last-user`
   (it is not an auth event) and does not touch perform-position keys (their
   shape is independent of the store schema).
3. **Files are shared.** `file:{path}` may be referenced by several snapshots.
   It is deleted only when no `snapshot-meta` (and no `download` journal)
   references it (§4.6).
4. **Meta before data.** `snapshot-meta` and `snapshot` are written in one
   `setMany` (one IDB transaction). Readers that find one without the other
   treat the snapshot as absent and schedule GC.
5. **Files before meta.** A `snapshot-meta` is only ever written after every
   file in its plan has either been stored or recorded in `missingFiles`.
6. **Wipe triggers — exactly two.** `wipeAll()` clears the store (`clear()`)
   and removes `bandmate_perform_position_*` from `localStorage`;
   `bandmate_preferred_instrument_*` keys are left alone (they are not offline
   data). It runs **only**:
   - (a) on **user-initiated sign-out**: awaited in `AuthButton.logout`
     **before** `supabase.auth.signOut()` is called (through
     `signOutEverywhereOrLocally()`, which removes the local session when the
     server can't be reached, so the sign-out always completes on the
     device); and
   - (b) on a **confirmed sign-in whose uid differs from `last-user`** (#1).

   Nothing else deletes offline data on an auth signal. In particular:
   - A `SIGNED_OUT` event not preceded by (a) in this tab — a refresh that
     failed with a non-retryable error (captive portal HTML, revoked token),
     another tab signing out, `youtubeService.requestAuthorization()`'s
     sign-out/sign-in (C11) — **hides** snapshots (§7.1). `last-user` is kept.
   - `getSession()` returning `null` online **hides** them too, and is never a
     reason to delete.
   - They reappear, with no download, as soon as a valid session for the
     same uid exists.

   **Accepted tradeoff:** after a token revocation or an involuntary sign-out,
   the blobs and rows stay on the device until the next sign-in (same user:
   shown again; different user: wiped by (b)) or until the user signs out
   explicitly. Until then no read returns them, because every read filters by
   `userId` and `currentUserId` is `null`. On a shared device this means a
   previous user's PDFs remain in IndexedDB — unreachable through the app,
   but not erased — for that window. Another tab's explicit sign-out is seen
   here as involuntary; the store is shared, so the wipe that tab ran already
   covers it.

---

## 4. Download state machine

Implemented inside `offlineSetlistService`; the UI observes it through
`onProgress` and `subscribe`. One download runs at a time per device.

### 4.1 States

```
idle ──download()──▶ planning ──▶ awaiting-confirmation ──confirm()──▶ downloading ──▶ committing ──▶ done
                        │                 │                                │                 │
                        │                 └── cancel() ──▶ cancelled       ├── cancel() ──▶ cancelled (journal deleted, files kept for GC)
                        ▼                                                  ▼
                      failed                                        done-with-errors (partial snapshot committed)
```

- **planning** — network. Fetch setlist, referenced songs, their
  `song_sheet_music` rows, the user's preferences for those songs, the band
  row; list each song's storage folder for sizes (C7). Compare with the store:
  files whose `file:{storagePath}` key already exists are `skipped-present`
  (the path is the identity; `rowUpdatedAt` is not compared, so a renamed or
  re-timed PDF is not downloaded again). Produce a `DownloadPlan`. No writes
  yet.
- **awaiting-confirmation** — the UI shows `bytesToDownload`, `fileCount`,
  `bytesAlreadyPresent`, and the `navigator.storage.estimate()` headroom. The
  first ever download also calls `navigator.storage.persist()` here and records
  the answer in `meta.persisted`.
- **downloading** — the journal `download:{setlistId}` is written first with
  the plan and `pendingSnapshot`. Files are fetched **sequentially** (one
  signed URL each, one `fetch`, one `set(file:…)`), and the journal's
  `outcomes` is rewritten after each file. Sequential because parallel 50 MB
  bodies on a phone trip memory limits and make quota failures unpredictable.
- **committing** — `setMany([snapshot-meta, snapshot, band])`, then
  `del(download:…)`. Then GC of files that this download superseded (Phase 3
  incremental update: `plan.filesToDelete` minus files referenced elsewhere).
- **done / done-with-errors** — `DownloadResult` returned. `done-with-errors`
  means `completeness: "partial"`; the UI lists `missingFiles` by song and
  PDF name and offers Retry (which re-plans; only missing files download).

### 4.2 Plan

```ts
export interface DownloadPlan {
  setlistId: string;
  bandId: number;
  songCount: number;
  filesToDownload: Array<OfflineFileRef & { bytes: number | null }>;  // null when list() gave no size
  filesAlreadyPresent: OfflineFileRef[];
  /** Phase 3 incremental update only: files the old snapshot had that the server no longer has. */
  filesToDelete: OfflineFileRef[];
  bytesToDownload: number;          // sum of known sizes
  filesWithUnknownSize: number;     // count of files with null size
  bytesAlreadyPresent: number;
  estimate: { usage: number; quota: number } | null;  // navigator.storage.estimate(), null if unsupported
}
```

Size comes from `storage.from("sheet-music").list("{bandId}/{songId}")`, one
call per distinct song, run in parallel with a concurrency cap of 4. A song
whose listing fails still downloads; its files count under
`filesWithUnknownSize`, and the confirmation says "+ N files of unknown size".

### 4.3 Atomicity

- A single `set(file:…)` is one IDB transaction: a file either fully exists or
  does not. There is no half-written blob to detect.
- The journal is rewritten after each file, so at most one file of work is
  lost on interruption (that file is simply re-fetched: `skipped-present`
  requires the key to exist).
- `snapshot-meta` + `snapshot` + `band` are one `setMany` transaction (§3.5
  #4). If it throws (quota, see §4.5), nothing of the snapshot is visible and
  the journal remains for resume.
- The previous snapshot of the same setlist (Phase 3 update) stays readable
  throughout; it is replaced by the commit transaction, never deleted first.
- **Rows vs. an in-flight download (A3).** `refreshSnapshotRows` does not run
  for a setlist that has a `download:` journal; the download's commit would
  otherwise overwrite newer rows with its `pendingSnapshot`. A resumed
  download (§4.4) can carry rows up to 7 days old, so every download commit is
  followed by one `refreshSnapshotRows` (a resume only runs online). The view
  therefore never regresses to older rows than it last showed.

### 4.4 Resume and cleanup

- **App start / `resumeInterruptedDownloads()`**: for every `download:*` key
  whose `userId` is the current user, if online → re-enter `downloading` from
  the journal (files with an outcome of `stored` are skipped after checking
  the key exists; `pendingSnapshot` rows are reused, no re-planning). If
  offline → leave the journal and surface it in the list as "Download
  interrupted — resume when online". A journal older than 7 days is discarded
  (rows may be stale); the user is told to download again.
- **cancel()**: aborts the in-flight `fetch` via `AbortSignal`, deletes the
  journal, leaves stored files for GC. Files are cheap to keep and expensive
  to re-download; GC at the next app start reclaims them if nothing else
  references them.
- **Navigation away** during a download does **not** cancel it: the service
  holds the promise; the progress UI re-attaches via `subscribe`. Page unload
  does interrupt it; the journal handles that.

### 4.5 QuotaExceededError

Per file:

1. `set(file:…)` rejects with a `DOMException` named `QuotaExceededError`
   (Safari sometimes reports it as an aborted transaction with
   `error.name === "QuotaExceededError"` on the transaction; both are caught).
2. The file's outcome is recorded as `quota`, with its `bytes`.
3. The **next** file is still attempted only if it is smaller than the one
   that failed; otherwise every remaining file is recorded as `quota` without
   fetching. This avoids downloading 200 MB that can never be stored while
   still fitting small PDFs after a large one failed.
4. Download continues to `committing` and ends `done-with-errors`. The result
   names each missing PDF and the total that did not fit.

For the commit transaction: on quota failure the commit is retried once after
GC; on a second failure the download is `failed` with reason `quota-rows`,
the journal is deleted, and the user is told to remove another setlist. This
is the only path where stored files may be orphaned deliberately; GC reclaims
them.

The pre-download estimate (`plan.estimate`) is advisory only: when
`quota - usage < bytesToDownload * 1.1` the confirmation dialog warns and
still allows the download.

### 4.6 Garbage collection

`collectGarbage()` runs at app start (after resume), after `removeSnapshot`,
after `cancel`, after a Phase 3 update commit, and after a row refresh commit
that released files (§8.2). It lists `file:*` keys and deletes any not
referenced by **any** `snapshot` or `download` journal in the store,
whatever its `userId`. (Referencing only the current user's would delete a
hidden user's files — §3.5 #6 — or, in `session-lost` mode with no current
user, every file.) Other users' data is only ever removed by `wipeAll()`
(§3.5 #1).

---

## 5. `offlineSetlistService` public API

`src/services/offlineSetlistService.ts`. Components never import
`offlineStore` or `idb-keyval` directly (CLAUDE.md service-layer rule).

### 5.1 Reads (work offline)

```ts
/** Store meta and schema check; wipes on mismatch (recording the notice, §3.5 #2). Cheap; memoized per session. */
export function openOfflineStore(): Promise<OfflineStoreMeta>;

/**
 * Set by BandContext on every auth resolution (§7.1). Every read below filters by
 * this id; null (signed out or session-lost) makes them all return empty/null
 * without deleting anything (A1).
 */
export function setOfflineCurrentUser(userId: string | null, opts?: { authenticated?: boolean }): void;

/** The last uid that had a valid session on this device (`last-user`), or null. Read by BandContext only. */
export function getLastUserId(): Promise<string | null>;
/** Called by BandContext with the uid of a valid session. Runs wipeAll() first if it differs from `last-user` (§3.5 #1). */
export function confirmSignedInUser(userId: string): Promise<{ wiped: boolean }>;

/** Whether hidden snapshots of `userId` exist, for the "Sign in again" state. Counts only; returns no names. */
export function countHiddenSnapshots(userId: string): Promise<number>;

/** The schema-wipe notice entries for the current user, or null (A4). */
export function getSchemaWipeNotice(): Promise<Array<{ setlistId: string; setlistName: string; bandId: number | null }> | null>;
/** No id: dismiss all of the current user's entries. With an id: drop that entry (downloaded again, or gone). The key goes when no entries remain. */
export function dismissSchemaWipeNotice(setlistId?: string): Promise<void>;

/** All snapshot metas of the current user, newest savedAt first. Empty if none or store unavailable. */
export function listSnapshots(): Promise<OfflineSnapshotMeta[]>;

/** Meta only; null when absent, another user's, or wrong schema. */
export function getSnapshotMeta(setlistId: string): Promise<OfflineSnapshotMeta | null>;

/** Full snapshot for performance mode; same null rules. */
export function getSnapshot(setlistId: string): Promise<OfflineSnapshot | null>;

/** The stored PDF, or null when not present. The caller creates and revokes the blob URL. */
export function getFile(storagePath: string): Promise<Blob | null>;

/** Bands of the current user seen in any snapshot (for BandContext offline). */
export function listOfflineBands(): Promise<Band[]>;

/** Interrupted downloads of the current user, for the list UI. */
export function listInterruptedDownloads(): Promise<Array<{ setlistId: string; setlistName: string; startedAt: string }>>;

export function getStorageUsage(): Promise<{
  usage: number | null; quota: number | null; persisted: boolean | null;
  bySetlist: Array<{ setlistId: string; bytes: number }>; distinctFileBytes: number;
}>;
```

### 5.2 Downloads (need network)

```ts
export interface DownloadOptions {
  onProgress?: (p: DownloadProgress) => void;
  signal?: AbortSignal;
  /** Phase 3: only fetch what the diff says changed. Default false = full plan. */
  incremental?: boolean;
}

export interface DownloadProgress {
  state: "planning" | "awaiting-confirmation" | "downloading" | "committing";
  filesDone: number; filesTotal: number;
  bytesDone: number; bytesTotal: number;
  currentFile: { songTitle: string; name: string } | null;
}

export interface DownloadResult {
  state: "done" | "done-with-errors" | "cancelled" | "failed";
  meta: OfflineSnapshotMeta | null;      // null on cancelled/failed
  missingFiles: OfflineMissingFile[];
  failure: OfflineError | null;
}

/** Planning only; no writes. Used to show the confirmation dialog. */
export function planDownload(setlistId: string, opts?: { incremental?: boolean }): Promise<DownloadPlan>;

/** Runs a previously returned plan to completion. Rejects (not returns) only for pre-conditions (§5.4). */
export function downloadSetlist(plan: DownloadPlan, opts?: DownloadOptions): Promise<DownloadResult>;

export function resumeInterruptedDownloads(): Promise<DownloadResult[]>;
export function cancelDownload(setlistId: string): void;
export function removeSnapshot(setlistId: string): Promise<void>;
export function collectGarbage(): Promise<{ deletedFiles: number; freedBytes: number }>;
export function requestPersistence(): Promise<boolean | null>;   // null if unsupported
/** Only callers: AuthButton.logout and confirmSignedInUser (§3.5 #6). */
export function wipeAll(): Promise<void>;
```

Row refresh and write-through (A3; Phase 2, used by performance mode):

```ts
export interface RowRefreshResult {
  status: "unchanged" | "updated" | "deleted" | "failed";
  /** Refs the new rows reference that are not in the store (reason "not-downloaded"). */
  filesNotDownloaded: OfflineFileRef[];
  /** Refs the old rows had and the new ones do not; GC runs after commit. */
  filesReleased: OfflineFileRef[];
}

/**
 * Fetches setlist, referenced songs, their song_sheet_music rows, the user's
 * preferences and the band row; if any differ from the snapshot, commits them
 * in one setMany (snapshot + snapshot-meta + band). Never fetches a PDF.
 * "deleted": setlist row gone → meta.freshness = "deleted", rows kept (D5).
 * "failed": network error → nothing written, snapshot untouched.
 */
export function refreshSnapshotRows(setlistId: string): Promise<RowRefreshResult>;

/** After a successful server write from performance mode: replace the snapshot's setlist row. */
export function patchSnapshotSetlist(setlistId: string, setlist: Setlist): Promise<void>;
/** After a successful setMySheetMusicPreference online: update preferredSheetMusicIds. */
export function patchSnapshotPreference(setlistId: string, songId: string, sheetMusicId: string): Promise<void>;
```

Both patches are no-ops when there is no snapshot for the setlist, and never
reject to the caller (log and fall back to `refreshSnapshotRows` on the next
open).

### 5.3 Freshness (Phase 3, need network)

```ts
export type FreshnessResult =
  | { status: "fresh"; checkedAt: string }
  | { status: "outdated"; checkedAt: string; diff: OfflineDiff }
  | { status: "deleted"; checkedAt: string }
  | { status: "unknown"; checkedAt: string; reason: "offline" | "error" };

/**
 * For every snapshot of the current user (or the given ids): cheap fingerprint
 * check (§6.3); where rows differ, refreshSnapshotRows() commits them. Then
 * sets freshness from the files alone: "outdated" iff the committed rows
 * reference files not in the store. Never downloads a PDF.
 */
export function checkForUpdates(setlistIds?: string[]): Promise<Record<string, FreshnessResult>>;

/** Reads back every file of a snapshot; updates verifiedAt or completeness/missingFiles. Works offline. */
export function verifySnapshot(setlistId: string): Promise<{ ok: boolean; missing: OfflineMissingFile[] }>;
```

### 5.4 Errors

`OfflineError` is a class with a `code` discriminator. Pre-condition failures
**reject**; per-file failures are **returned** in `DownloadResult`.

| `code` | Thrown by | When |
|--------|-----------|------|
| `not-authenticated` | plan, download, check, refresh | No valid session. Downloads and refreshes need one; `offline-cached` and `session-lost` both count as not authenticated here. |
| `offline` | plan, download, check | `useOnlineStatus` says offline, or the first request fails with a network error. |
| `setlist-not-found` | plan | `setlists` returns no row (deleted, or RLS hides it). Same for a song that vanished between plan and download: recorded per file as `not-found`. |
| `download-in-progress` | download | Another download is running. The UI offers to cancel it. |
| `plan-stale` | download | `plan.setlistId` already has a newer journal or the plan is older than 10 minutes (signed URLs and sizes may have changed). Re-plan. |
| `storage-unavailable` | any | `indexedDB.open` fails (Safari private mode, "InvalidStateError", disk full at open). Every read API then returns empty/null and the UI hides offline features with an explanation. |
| `quota-rows` | download (returned as `failed`) | The commit transaction itself does not fit (§4.5). |
| `schema-mismatch` | never thrown | Handled by wiping (§3.5 #2); surfaced through the `schema-wipe-notice` ("The app was updated…"), never as a silent empty list. |
| `snapshot-owned-by-other-user` | never thrown | Filtered out by reads; wiped at a confirmed sign-in of a different uid (§3.5 #1). |
| `cancelled` | download (returned as `cancelled`) | `cancelDownload` or `signal.abort()`. |

Per-file `reason` values: `quota`, `network` (fetch threw or status 0/5xx),
`not-found` (404 from storage or row gone), `forbidden` (401/403: membership
changed mid-download), `unknown`.

### 5.5 Events

```ts
export type OfflineEvent =
  | { type: "snapshot-changed"; setlistId: string }   // saved, updated, removed, freshness changed
  | { type: "download-progress"; setlistId: string; progress: DownloadProgress }
  | { type: "store-wiped"; reason: "sign-out" | "user-changed" | "schema" }
  | { type: "visibility-changed" };                   // current user set/cleared (hidden ⇄ shown)

export function subscribe(listener: (e: OfflineEvent) => void): () => void;
```

Badges and lists re-read metas on `snapshot-changed`; the progress modal
re-attaches on `download-progress`. No React state lives in the service.

### 5.6 The one write path: sheet music preferences

```ts
/** Offline: remember a PDF choice in the snapshot only. */
export function recordLocalPreference(setlistId: string, songId: string, sheetMusicId: string): Promise<void>;

/** Online: push localPreferenceOverrides with setMySheetMusicPreference, best effort, then clear them. */
export function flushLocalPreferences(setlistId: string): Promise<void>;
```

`flushLocalPreferences` runs once when performance mode opens **online** with
a snapshot present, and is fire-and-forget: a failure logs and keeps the
overrides for the next attempt. It never blocks rendering and never toasts.
This is the entire extent of offline writes (C5).

Online, a PDF choice goes to the server as today and, once
`setMySheetMusicPreference` resolves, `patchSnapshotPreference` updates the
snapshot (A3), so the choice survives going offline. The flush runs **before**
the row refresh on open, so the refresh reads back the flushed preferences
instead of overwriting the local overrides with stale server values; an
override that failed to flush wins over the refreshed server value.

---

## 6. Phase 3: fingerprint, update check, incremental update, management

### 6.1 Fingerprint — exact definition

```ts
export interface OfflineFingerprint {
  /** setlists.updated_at as returned by PostgREST (ISO string, not reformatted). */
  setlistUpdatedAt: string;
  /** Sorted by song id. songs.updated_at requires the migration in §6.2. */
  songs: Array<[songId: string, updatedAt: string]>;
  /** Sorted by sheet music id. file_url included so a moved file counts as a change. */
  sheetMusic: Array<[id: string, songId: string, updatedAt: string, fileUrl: string]>;
  /** SHA-256 hex of the canonical JSON of the three fields above (crypto.subtle). Convenience for equality. */
  hash: string;
}
```

Rules:

- The set of song ids is taken from the **server's** `setlist.songs` at check
  time, not from the snapshot, so songs added to the setlist are seen. The
  snapshot's song ids are compared against it, so removed songs are seen.
- Rows are compared as **sets of ids first, timestamps second**. A row present
  in the snapshot and absent from the server response is a **deletion**
  (setlists: `deleted` status; songs and sheet music: removed from the
  snapshot by the row refresh, with the id in `lastDiff.applied.…Removed`).
  A row present on the server and absent from the snapshot is an addition.
  Deletions are never inferred from timestamps.
- An id that disappears because the user lost access (RLS now hides it) is
  indistinguishable from a deletion and is treated the same: the local copy
  is stale either way.
- Strings are compared byte-for-byte. Never parse the timestamps: PostgREST
  formats them consistently, and parsing loses sub-millisecond precision.
- Band name/avatar are **not** part of the fingerprint. They refresh on any
  row refresh.
- The fingerprint is a **trigger for a row refresh**, not a freshness verdict
  (A3). A fingerprint mismatch leads to `refreshSnapshotRows`, which commits
  the rows and recomputes the fingerprint; freshness is then decided by files
  alone.

What each user action maps to:

| Edit | Detected via | Effect when online (A3) |
|------|--------------|-------------------------|
| Reorder items, change notes, add/remove songs, rename setlist | `setlists.updated_at` (every write in `setlistsService` sets it) | Rows refreshed automatically; stays `fresh` unless an added song brings PDFs not in the store |
| Lyrics, chords, key, tempo, timing data | `songs.updated_at` — **only after the migration in §6.2** | Rows refreshed automatically; stays `fresh` |
| Add a PDF | id set difference on `song_sheet_music` | Row refreshed; the PDF shows "Not downloaded"; `outdated` |
| Delete a PDF | id set difference on `song_sheet_music` | Row refreshed; the PDF disappears from the selector; its file is GC'd if unreferenced; stays `fresh` |
| Rename PDF, change instrument, page timings, reorder PDFs | `song_sheet_music.updated_at` (trigger exists) | Rows refreshed automatically; the stored file is reused (path unchanged); stays `fresh` |
| Replace a PDF | Does not exist as a flow; it is delete + add, covered above | `outdated` (the new file) |
| Setlist deleted | `setlists` query returns no row → `deleted` | `deleted`; rows kept so it still performs until removed |

```ts
export interface OfflineDiff {
  /** Row changes the last refresh found and already committed (informational, for "what changed"). */
  applied: {
    setlistChanged: boolean;
    songsChanged: string[]; songsAdded: string[]; songsRemoved: string[];
    sheetMusicChanged: string[]; sheetMusicAdded: string[]; sheetMusicRemoved: string[];
  };
  /** Files the current rows reference that are not in the store. Non-empty ⇔ freshness "outdated". */
  filesToDownload: Array<OfflineFileRef & { bytes: number | null }>;
  /** Files the previous rows referenced and the current rows do not; already handed to GC. */
  filesReleased: OfflineFileRef[];
}
```

### 6.2 Migration: `songs.updated_at`

`supabase/migrations/<timestamp>_songs_updated_at.sql`, idempotent:

- `ALTER TABLE songs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`
- Backfill `updated_at = created_at WHERE updated_at IS NULL` (one-off; the
  default covers new rows).
- `DROP TRIGGER IF EXISTS … ; CREATE TRIGGER update_songs_updated_at BEFORE UPDATE ON songs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`
  (function already exists from `SHEET_MUSIC_MIGRATION.sql`; recreate with
  `CREATE OR REPLACE` for safety, as the preferences migration does).
- Add `updated_at: string` to `Song`. No RLS change: the column is covered by
  the existing row policies. Note which policies were checked in the PR.

Until this migration is applied, the fingerprint stores `""` for song
timestamps and the check treats song content as unchanged; the PR that adds
the check must land after the migration is applied to production.

### 6.3 The check — three cheap queries, then rows if needed, never files

`checkForUpdates` runs, per snapshot:

1. `setlists.select("id, updated_at, songs").eq("id", setlistId).maybeSingle()`
   → `null` ⇒ `deleted`.
2. `songs.select("id, updated_at").in("id", unionOfServerAndSnapshotSongIds)`.
3. `song_sheet_music.select("id, song_id, updated_at, file_url").in("song_id", serverSongIds)`.
4. Only if the fingerprint differs: `refreshSnapshotRows(setlistId)` (§5.2),
   which fetches full rows and commits them. The user's preferences are not
   in the fingerprint, so they are refreshed whenever step 4 runs and on
   every perform-mode open (§8.2), not on the cheap check alone.

Snapshots of the same band are checked in one batch (queries 2 and 3 use the
union of ids across them) so a device with five setlists still issues about
three requests per band when nothing changed. Each result updates
`snapshot-meta.freshness` (from files only, §3.2), `lastCheckedAt`,
`lastDiff`, and emits `snapshot-changed`.

Triggers: app start (once, after resume + GC), `online` event with a 5 s
debounce, opening a snapshot's detail online, and the Refresh button in
management. Opening performance mode online runs `refreshSnapshotRows`
directly (Phase 2, §8.2) rather than the cheap check. Never on a timer while
performing, never downloads a PDF, never runs offline (returns
`unknown/offline`). A row refresh that commits while performance mode is open
re-renders it (§8.2).

### 6.4 Incremental update

"Update offline copy" now concerns **files only**: rows are already current
(A3). It = `planDownload(setlistId, { incremental: true })` → confirmation
with the bytes of `lastDiff.filesToDownload` → `downloadSetlist(plan)`. The
plan's `filesToDownload` is that list (recomputed against the store at plan
time); `filesAlreadyPresent` is every other file the rows reference;
`filesToDelete` is empty in practice, because files the rows stopped
referencing were already released by the row refresh and GC'd. Rows are
refetched in full anyway (cheap, and the plan must not commit older rows than
the snapshot holds). Commit replaces the snapshot in one transaction (§4.3).
The `outdated` state survives a failed update.

### 6.5 Verify

`verifySnapshot` reads every `file:` key of the snapshot and checks
`blob.size === bytes` and that the blob can be sliced (`blob.slice(0, 1)`
resolves to non-empty; Safari has returned zero-length blobs after eviction).
Success sets `verifiedAt`; failure flips `completeness` to `partial` with the
missing files listed, and the UI offers Retry (a normal re-plan). This is the
"Offline copy verified" state the intent's risk section asks for, and it
works offline.

### 6.6 Management UI ("Offline setlists")

Lives in `BandSettings` as a new section (visible to every role, including
guests, since it is device-local) **and** as an item in the user menu of
`AuthButton` so it is reachable without a band. Shows: device usage vs quota
(`getStorageUsage`), `persisted` state with a one-line explanation, and per
snapshot: band, name, saved date, size, freshness badge, Verify, Refresh
(update), Remove. Interrupted downloads appear with Resume/Discard.

Freshness badge states in `SetlistList` and `SetlistDetailView`: none,
"Available offline · {date}", "Outdated" (tooltip: "New sheet music to
download"), "Deleted on server", "Partial". `{date}` is `savedAt`; the
management view also shows "Updated {rowsUpdatedAt}" when rows were
refreshed after the download.

---

## 7. Offline entry point

### 7.1 Who is the user

```ts
export type AuthMode =
  | "session"          // valid session; snapshots of that uid visible
  | "offline-cached"   // no usable token, the refresh failed on the network; last-user's snapshots visible
  | "session-lost"     // no stored session, but last-user exists and never signed out; snapshots HIDDEN
  | "signed-out";      // no session, no last-user → landing
```

`BandContext` resolves `user` in this order, stopping at the first hit:

1. `getSession()` returns a session → `user` from it, `authMode: "session"`.
   Call `confirmSignedInUser(uid)` (writes `last-user`; wipes first if it
   differs — §3.5 #1) **before** `setOfflineCurrentUser(uid)` and before any
   list renders.
2. `getSession()` returns `null` **with an `AuthRetryableFetchError`** (the
   refresh could not reach the auth server: airplane mode, weak signal, no
   data behind a connected Wi-Fi — C2; auth-js keeps the stored session in
   this case, C11) and `last-user` exists → a **minimal user object** `{ id }`
   typed as `OfflineUser`, `authMode: "offline-cached"`,
   `setOfflineCurrentUser(lastUserId)`, and `reportNetworkFailure()` (§7.3).
   This holds whether `navigator.onLine` is true or false: it is what makes B1
   pass and what keeps a venue's weak signal from hiding the show.
3. `getSession()` returns `null` otherwise (no stored session, or a
   non-retryable error) and `last-user` exists → `user: null`,
   `authMode: "session-lost"`, `setOfflineCurrentUser(null)`. Nothing is
   deleted; `last-user` is kept.
4. Otherwise `null`, `authMode: "signed-out"` → landing page.

**Don't wait on `getSession()` (A6, amended 2026-09-26).** With a token inside the 90 s
refresh margin or already expired — the normal case on show day, since
tokens last 1 h — `getSession()` takes ≈25 s to reach step 2 whenever the
auth server can't be reached (§1): offline, and equally on weak signal or
behind a captive portal, where `navigator.onLine` is `true`. So
`BandContext` races `getSession()` against
`GET_SESSION_OFFLINE_TIMEOUT_MS = 1500` **online or offline**; with a valid
token `getSession()` answers in ≈0 ms and the timeout never matters:

- `getSession()` settles first → steps 1–4 as above.
- The timeout fires first and `last-user` exists → resolve provisionally as
  step 2: `{ id: lastUserId }`, `authMode: "offline-cached"`,
  `setOfflineCurrentUser(lastUserId)`, `isCheckingAuth: false`.
- The timeout fires first and there is no `last-user` → keep waiting; there
  is nothing on the device to show, so the landing can wait for the real
  answer.

When the raced `getSession()` settles later, reconcile by the A1 rules and
the steps above, never by a wipe the provisional state caused: a session for
the same uid → step 1 (`authMode: "session"`, keep the `user` reference
stable if the id is unchanged); a session for a different uid → step 1,
whose `confirmSignedInUser` wipes before any list renders (§3.5 #1); `null`
with `AuthRetryableFetchError` → stay `offline-cached`; any other `null` →
step 3 (`session-lost`, hidden, nothing deleted). A provisional state never
runs confirmed-state side effects: no `confirmSignedInUser`, no wipe, no
`BandStorage.clearSelectedBandId()`. Only a device with **no** `last-user`
(first sign-in, or after an explicit sign-out) still waits the full ≈25 s
behind a captive portal: there is nothing on the device to show — accepted
residual risk, recorded in §11.

Every consumer that needs more than the id (`AuthButton` display name,
invitation flows) already handles `user` loosely; the context exposes
`authMode` so they can hide themselves.

Auth events:

- `SIGNED_IN` / `TOKEN_REFRESHED` / `INITIAL_SESSION` **with** a session →
  step 1 (so leaving `offline-cached` or `session-lost` for the same uid
  shows the snapshots again with no download; a different uid wipes).
- `SIGNED_OUT` while `AuthButton.logout` is running in this tab → nothing
  extra (the wipe already ran, §3.5 #6a); `authMode: "signed-out"`.
- Any other `SIGNED_OUT` → **involuntary**: `authMode: "session-lost"`,
  `setOfflineCurrentUser(null)`, emit `visibility-changed`. No wipe.

Coming back online in `offline-cached` re-runs `getSession()`: a session →
step 1; a retryable error → stay; anything else → step 3. None of these
deletes anything.

**What `session-lost` looks like.** `user` is `null`, so routes behave as
signed out, except `/`: when `countHiddenSnapshots(lastUserId) > 0`, `Home`
renders `OfflineHome` in its locked state — "Sign in again to use your
offline setlists" with a Sign in button — instead of the landing. It shows a
count only, no setlist names (the device may have changed hands). Signing in
as the same user shows them again with no download; signing in as someone
else wipes them first (§3.5 #1).

**Known residual risk.** A captive portal that yields a non-retryable auth
error makes auth-js delete the stored session (C11). The snapshots are safe
but hidden, and signing in again needs a real connection. The venue risk
moves from "data deleted" to "data locked until you get signal once";
acceptable, and the checklist covers it (§11).

### 7.2 Which band

`BandContext` band resolution becomes (split across PRs by A5):

- **PR 2.0 — no infinite spinner (C3).** Both `getMyBands()` calls get a
  `catch`; `isResolvingBand` becomes `false` in every path (success, error,
  no user). On error `bands` stays `[]`, `selectedBand` `null`, and
  `reportNetworkFailure()` is called. Before PR 2.2a this renders the normal
  no-band UI instead of a spinner; that is the whole fix, and it is enough
  on its own.
- **PR 2.2a — offline branch.** Whenever `authMode === "offline-cached"`,
  and in `"session"` when `getMyBands()` fails with a **network** error
  (`isNetworkError`; an HTTP error keeps the no-band UI, no fallback, no
  `reportNetworkFailure()`): `listOfflineBands()` → `bands`;
  `selectedBand` = the one in `BandStorage`, else the only one, else `null`.
  In `session-lost` and `signed-out` there are no bands.
- With `user` set and no local bands: `BandSelector` is **not** shown offline
  (it would try to create/list bands). An `OfflineEmptyState` renders instead:
  "You're offline and nothing is saved on this device."

### 7.3 Where the setlist is

- **`/`** offline with a user: `Home` renders `OfflineHome` instead of the
  dashboard: the snapshot list of the selected band (name, saved date,
  completeness, Perform button) plus interrupted downloads. No dashboard
  fetches are issued. In `session-lost`: the locked state of §7.1.
- **Schema-wipe notice (A4).** When `getSchemaWipeNotice()` returns entries,
  a one-time notice renders at the top of the online dashboard `Home`, of
  `OfflineHome` and of `OfflineSetlistList`: "The app was updated. Download
  these setlists again to use them offline", listing each `setlistName` with
  a **Download** button (opens the normal plan/confirm flow for that
  `setlistId`) when online, and "Needs a connection" when offline. Entries of
  bands other than the selected one are listed too, labeled by band when
  known. Dismissing it, or downloading every listed setlist, calls
  `dismissSchemaWipeNotice()`. A setlist that no longer exists fails
  planning with `setlist-not-found` and is removed from the notice.
- **`/setlists`** offline: `SetlistsView` renders the same list component.
- **`/setlists/:setlistId`** offline: if a snapshot exists, a new, small
  `OfflineSetlistDetail` renders (name, description, items in order with
  titles and special items, PDF count per song, offline badge, Perform). If
  none: "Not available offline" with a link home. `SetlistDetailView` is not
  mounted offline at all; it stays untouched.
- **`/setlists/:setlistId/perform`** offline: performance mode via the
  snapshot data source (§8). Deep links work because the SW's
  `navigateFallback` serves `index.html` for any in-scope path; the installed
  PWA's `start_url` is `/`, so the usual path is Home → Perform.
- **`/shows/:showId`** offline: out of scope; falls into the generic offline
  fallback ("This page needs a connection") rather than an error toast.

`useOnlineStatus` (new hook in `src/hooks/`): `navigator.onLine` seeded,
`online`/`offline` events, plus `reportNetworkFailure()` that flips to
offline for 30 s after a failed request when `navigator.onLine` still says
true (captive portals, no-data signal). Exposed through `BandContext` so the
whole tree shares one value.

---

## 8. Performance mode: extraction before offline branches

`SetlistPerformanceView.tsx` is 2,892 lines. Its network I/O is in six places:

| Where | What |
|-------|------|
| `loadData` effect (l. 407) | `getSetlist` → `getBandSongs` (whole library) → `getPreferredInstrument` → `getMySheetMusicPreferences` |
| `loadSheetMusicList` (l. 588) | `getSheetMusicForSong` for the **current** song on every navigation |
| URL effect (l. 646) | `getSheetMusicUrl` (signed-URL POST) on every PDF selection |
| `handleSelectSheetMusic` (l. 619) | `setPreferredInstrument` (local) + `setMySheetMusicPreference` (server, toast on error) |
| `handleSaveOrder` (l. 361) | `updateSetlist` |
| `SheetMusicUpload` modal, `usePerformanceSync` | Uploads; Realtime |

### 8.1 Step 1 — extract with no behaviour change except prefetch (PR 2.1)

Create `src/hooks/useSetlistPerformanceData.ts` returning one object the
component consumes in place of its current state:

```ts
export interface PerformanceData {
  status: "loading" | "ready" | "error";
  error: "not-found" | "not-authenticated" | "network" | null;
  setlist: Setlist | null;
  items: SetlistItem[];                       // sorted by position
  songsById: Record<string, Song>;            // referenced songs only
  sheetMusicBySongId: Record<string, SheetMusic[]>;  // all songs, prefetched
  preferredSheetMusicIds: Record<string, string>;    // server prefs merged with local overrides
  preferredInstrument: string | null;
  /**
   * Resolves a PDF to something SheetMusicViewer can open; blob URL offline, signed URL online.
   * A new call cancels the previous one (it rejects with AbortError), so a stale resolution
   * after a fast song change never replaces the current PDF.
   */
  resolvePdfUrl: (sm: SheetMusic) => Promise<string>;
  /**
   * Persists the choice wherever the mode allows (server online, snapshot offline).
   * Network source: a failed server write toasts `sheetMusic.preferenceError`, as before
   * PR 2.1. Snapshot source (PR 2.4): never toasts.
   */
  selectSheetMusic: (sm: SheetMusic) => void;
  /**
   * Reorder save. Online: updateSetlist, then (PR 2.4) patchSnapshotSetlist with the
   * returned row. Rejects on server failure so the view keeps its existing error toast.
   */
  saveOrder: (items: SetlistItem[]) => Promise<void>;
  /** Called by the view after SheetMusicUpload succeeds; (PR 2.4) triggers refreshSnapshotRows. */
  onSheetMusicUploaded: () => void;
  /** Retries a failed sheet-music prefetch (one in flight, no toast); no-op once loaded. */
  retryStaleSheetMusic: () => void;
  source: "network" | "snapshot";
  /** PR 2.4. Sheet music ids referenced by the rows but not in the store; the selector shows them as "Not downloaded". */
  unavailableSheetMusicIds: ReadonlySet<string>;
  capabilities: { canReorder: boolean; canUpload: boolean; canSync: boolean; canEditNotes: boolean };
}
```

Behind it, a `PerformanceDataSource` (`src/hooks/performanceDataSource.ts`)
whose `open(setlistId)` returns a session:

```ts
interface PerformanceSession {
  load(signal: AbortSignal): Promise<PerformanceRows>;       // rejects PerformanceDataError(code)
  subscribe(listener: (rows: PerformanceRows) => void): () => void;
  refresh(): Promise<void>;                                   // network: sheet music rows; snapshot: refreshSnapshotRows
  isSheetMusicStale(): boolean;
  resolvePdfUrl(sm: SheetMusic, signal: AbortSignal): Promise<{ url: string; release?: () => void }>;
  savePreference(sm: SheetMusic): Promise<void>;              // optimistic emit, then persist
  saveOrder(items: SetlistItem[]): Promise<void>;             // persist, then emit
  close(): void;
}
```

The session holds the current rows and delivers every change after load as
a full `PerformanceRows` replacement through `subscribe`: a background row
refresh (A3, PR 2.4), `refresh()` after an upload, and write-through after a
successful write. Two rules every source follows, so a refresh landing
mid-performance cannot clobber local state:

1. **Reference identity.** An emit reuses the objects of the parts that did
   not change (a sheet-music refresh keeps the same `setlist`, so the hook's
   sorted `items` stay `===` and nothing downstream reseeds).
2. **Reorder protection.** The view keeps its own copy of the items for
   drag-and-drop and does not reseed it from `items` while in reorder mode;
   leaving reorder mode takes the latest emitted items.

A failed sheet-music fetch never blocks performance mode: the session is
marked stale and the hook's `retryStaleSheetMusic` (called by the view on song
change and on entering the sheet music view) retries with at most one
request in flight, without a toast, until it succeeds.

The one implementation in PR 2.1, `networkPerformanceDataSource`, reproduces
today's calls with two improvements that are needed anyway:

- `getSongsByIds(ids)` (new in `songsService`) instead of `getBandSongs`;
  performance mode only ever looks up referenced songs (`getSongById`).
- `getSheetMusicForSongs(ids)` (new in `songSheetMusicService`, one `.in()`
  query, grouped and sorted by position) prefetched at load, so navigation no
  longer fetches per song. `loadSheetMusicList` becomes a pure lookup.

`resolvePdfUrl` online keeps calling `getSheetMusicUrl`. The component keeps
its `allSongs.find` sites by reading from `songsById`. `handleSaveOrder`
calls `saveOrder` instead of `updateSetlist` directly (same behaviour in this
PR), so PR 2.4 can add the snapshot patch in one place; upload and sync code
paths are otherwise untouched. `capabilities` are all `true`
except `canReorder`/`canUpload`/`canEditNotes`, which follow the existing
guest rule (`selectedBand.user_role !== "guest"`). In PR 2.1 they are computed
but **not consumed**: the view had no guest gating before (Reorder and Add PDF
were visible to guests), so enforcing them would be a behaviour change. PR 2.4
gates on them together with the offline gating (§8.3).

Definition of done for this step: the view renders identically online; the
network tab shows one `song_sheet_music` request per setlist open instead of
one per song; lint and build pass; the flow is exercised on the dev server.

### 8.2 Step 2 — snapshot source (PR 2.4)

`snapshotPerformanceDataSource` implements the same interface from
`getSnapshot`. `resolvePdfUrl` calls `getFile` and returns
`URL.createObjectURL(blob)`; the hook revokes the previous URL when the
selection changes and on unmount. `selectSheetMusic` calls
`recordLocalPreference`.

Source selection in the hook, in this order:

1. Snapshot exists for this user → **snapshot**, even when online. Render
   from it immediately (instant, immune to weak signal; the intent's §2).
   Then, **if online** (A3), in the background and in this order:
   1. `flushLocalPreferences(setlistId)` (§5.6);
   2. `refreshSnapshotRows(setlistId)`: fetches the setlist, referenced songs,
      `song_sheet_music`, preferences and band. If anything differs, it
      commits the new rows to the snapshot in one transaction and the hook
      re-reads the snapshot and re-renders. **No PDF is downloaded.**
      Files released by the new rows go to GC; files the new rows reference
      but the store lacks become `missingFiles` with reason
      `"not-downloaded"`, appear in `unavailableSheetMusicIds`, and set
      freshness to `"outdated"`, which (Phase 3) shows the "Update offline
      copy" banner — now only about files.
   3. A failed refresh (weak signal) is silent: the snapshot keeps rendering,
      `reportNetworkFailure()` is called, nothing is written.

   Re-render rules for a refresh that lands mid-performance: the current
   item is kept by identity (`SetlistItem.id`, or `song_id` for songs), not
   by index; if it was removed, the index is clamped. The selected PDF is
   kept if it still exists.
2. No snapshot and online → **network**, with the Phase 1 timeout.
3. No snapshot and offline → `status: "error", error: "network"`, rendered
   as "Not available offline" with a Back button. No `navigate("/setlists")`
   bounce, no toast (C10).

`capabilities` offline: `canReorder`, `canUpload`, `canEditNotes`, `canSync`
all `false`. Online with a snapshot: as today, with **write-through**:

- Reorder: `saveOrder` → `updateSetlist` → on success
  `patchSnapshotSetlist(setlistId, returnedRow)` (`updateSetlist` returns the
  updated `Setlist`; the patch normalizes its items and also updates
  `fingerprint.setlistUpdatedAt`, so the next check does not see the user's
  own write as a change). The view shows the new order immediately and after
  leaving and reopening, online or offline.
- PDF preference: `setMySheetMusicPreference` → on success
  `patchSnapshotPreference` (§5.6).
- Upload: after `SheetMusicUpload` succeeds, `onSheetMusicUploaded` runs
  `refreshSnapshotRows`; the new PDF appears as "Not downloaded" and the
  snapshot becomes `outdated` (the bytes are not copied from the upload into
  the store: that would be a second download path to keep consistent).

A server write that fails leaves the snapshot untouched. There is no queue:
offline these actions are disabled (above).

### 8.3 UX gating in the view (same PR)

- Offline badge in `TopBarLeft` when `source === "snapshot"` and offline
  (icon + "Offline"); when `source === "snapshot"` and online, a subtle
  "Offline copy" badge instead.
- `SyncControls` receives `disabled` + `disabledReason`
  (`t("performanceSync.needsConnection")`) and renders its trigger inert.
  `usePerformanceSync({ enabled: capabilities.canSync })` skips its mount
  effects and never subscribes when disabled (C9).
- Reorder button, Add PDF button and the upload modal are hidden when their
  capability is false. The PDF selector still switches among the snapshot's
  PDFs; a PDF listed in the snapshot but missing from the store
  (`unavailableSheetMusicIds`: any `missingFiles` reason, including
  `"not-downloaded"` from a row refresh) is shown disabled with "Not
  downloaded", online and offline alike; the Update banner (Phase 3) or
  Retry is how it gets fetched.
- `PDFErrorBoundary` fallback text offline says the file is not on the device.

### 8.4 Service worker changes (PR 2.0)

- `registerType: 'prompt'`. `PwaReloadPrompt` already implements the prompt
  flow; it starts working. Add: the banner is **not** shown while the route
  matches `/setlists/:id/perform` (deferred until the user leaves), so a
  waiting worker never reloads a show.
- Register with `workbox-window` in `PwaReloadPrompt` (`injectRegister:
  false`), not `virtual:pwa-register`: the latter reloads on `controlling`
  after its prompt fired, so another tab accepting the update would reload a
  performing tab. The page reloads only from the Reload button; a worker
  activated from another tab just shows the prompt.
- `maximumFileSizeToCacheInBytes: 5 MiB` and a post-build guard,
  `scripts/check-precache.mjs` (part of `npm run build`): the build fails if
  any `.js`/`.mjs`/`.css`/`.html` in `dist/` is not in the precache manifest.
- Space Grotesk self-hosted via `@fontsource/space-grotesk` (weight 700 only),
  Google Fonts links removed from `index.html`, `woff2` added to
  `globPatterns` (also precaches Bootstrap Icons).
- `supabase-api` rule: `urlPattern` narrowed to `url.hostname.endsWith("supabase.co") && (url.pathname.startsWith("/rest/v1/") || url.pathname.startsWith("/auth/v1/"))`. Storage requests are then handled by the browser only (C8).
- Keep `navigateFallback` as is: every offline route is the SPA shell, so no dedicated offline page is precached.

---

## 9. iOS constraints

Stated as constraints on the design, each with what the spec does about it.
Version-specific claims are checked on the device checklist (§11), not
assumed.

1. **Installed-PWA storage isolation.** On iOS, a home-screen web app has its
   own data store, separate from Safari: `localStorage`, IndexedDB, Cache
   Storage and the Supabase session are **not shared** between the Safari tab
   and the installed app. A setlist downloaded in Safari does not exist in the
   installed app, and vice versa; the user must also sign in inside the
   installed app once. → The download confirmation and the management view
   show "Saved on this device, in this app" and, when running in a browser tab
   on iOS (`!window.matchMedia("(display-mode: standalone)").matches`), a hint
   to install the app and download there. Acceptance tests run in the
   installed app only.
2. **Eviction.** Safari can delete script-writable storage for origins not
   interacted with for a period; installed home-screen apps are treated more
   leniently, and `navigator.storage.persist()` may resolve `true` without
   changing that, or resolve `false`. → `persist()` is called once, its answer
   is displayed but never relied on. `verifySnapshot` (§6.5) exists so the
   band can confirm on the day of the show; the offline home shows
   "Verified {date}" or "Not verified" per snapshot. Total data per origin is
   capped by an opaque quota; `estimate()` values on Safari are rounded and
   approximate, so the UI says "about".
3. **Zero-length blobs after partial eviction.** Seen in the wild: the key
   exists, the blob reads as empty. → `verifySnapshot` slices the blob; the
   viewer treats a load error on a snapshot file as "missing" and marks it in
   `missingFiles` rather than crashing the view.
4. **Service worker activation during a show.** With `prompt` mode a new
   worker waits; iOS may still terminate and restart the running worker at any
   time, which is harmless because the precache is on disk. A backgrounded PWA
   can be killed and relaunched; the relaunch is a fresh navigation that the
   waiting worker could take over **if** `skipWaiting` were on — it is not. →
   The banner defers on the perform route (§8.4). Performance mode also
   persists `{ currentIndex, contentView, selectedSheetMusicId, savedAt }`
   per setlist in **`localStorage`** under
   `bandmate_perform_position_{userId}_{setlistId}` (§3.2,
   `src/lib/performPosition.ts`) on every change, and restores it on mount,
   so a relaunch during a show returns to the same song. `sessionStorage` is
   not an option: iOS clears it when it kills and relaunches the PWA (A2). A
   position older than 12 hours is discarded on read, so next week's show
   starts at the top. `wipeAll()` removes these keys. (Small; PR 2.4.)
5. **Memory.** Holding several 50 MB blobs and their blob URLs at once can
   crash the tab on older iPhones. → Only the current PDF has a blob URL;
   the previous one is revoked before the next is created; `getFile` is never
   called for prefetching.
6. **`fetch` of large bodies on weak signal.** A 50 MB download that stalls
   holds the sequence. → Per-file timeout of 60 s of no progress (via
   `ReadableStream` reads), recorded as `network`, then the next file.
7. **Sign-in inside the installed app** uses the same OAuth redirect flow;
   nothing changes, but the checklist verifies that the session persists
   across app relaunches in standalone mode (it lives in `localStorage`).
8. **Android Chrome** has none of the isolation above; the same tests run
   there to confirm parity, plus the `persist()` prompt path (Chrome grants
   it silently for installed apps).

---

## 10. Acceptance criteria

All "offline" steps mean airplane mode **and** a full app kill/relaunch of
the installed PWA unless stated otherwise. `S1` is a setlist with at least 3
songs, 2 of them with 2 PDFs each, one break and one section item.

### Phase 2 — download

- **A1** Given I am online on the detail of `S1`, when I tap "Make available
  offline", then I see the number of songs and PDFs and an approximate size
  before anything downloads, and I can cancel with nothing stored.
- **A2** Given the confirmation, when I confirm, then progress shows file
  count and bytes, the action ends with "Available offline · {date}", and
  `listSnapshots()` contains `S1` with `completeness: "complete"`.
- **A3** Given `S1` is downloaded, when I open the show that links `S1` and
  tap "Get this show ready offline", then no file downloads again
  (`filesAlreadyPresent` covers all) and the result is the same snapshot.
- **A4** Given a download of `S1` is running, when I navigate to another page
  and back, then the progress modal shows the current file and completes.
- **A5** Given a download of `S1` is running, when I kill the app and relaunch
  online, then it resumes from the journal without re-downloading stored files
  and completes.
- **A6** Given the device quota is nearly full, when a 40 MB PDF does not fit,
  then the download ends "with errors", names that PDF and its song,
  `completeness` is `"partial"`, and smaller remaining PDFs were still stored.
- **A7** Given I am a **guest**, when I open `S1`'s detail, then the download
  action is present and works.
- **A8** Given I am offline, when I open `S1`'s detail (no snapshot), then the
  action is disabled with "Needs a connection".
- **A9** Given `S1` and `S2` are downloaded and a new version of the app
  bumps `OFFLINE_SCHEMA_VERSION`, when I open the app, then Home and the
  offline list show once "The app was updated. Download these setlists again
  to use them offline" naming `S1` and `S2`, each with a Download button when
  online ("Needs a connection" offline); downloading one removes it from the
  notice, dismissing hides it for good, and another user signing in on the
  device does not see my setlist names.

### Phase 2 — perform

- **B1** Given `S1` is downloaded and the token is older than 1 hour, when I
  go offline, kill and relaunch the app, then I land on the offline home with
  `S1` listed, not on the landing page and not on the login page.
- **B2** Given B1, when I tap Perform on `S1`, then performance mode opens
  within 1 s, shows the offline badge, and I can step through every song,
  break and section to the end with arrow keys/buttons.
- **B3** Given B2, when I switch to Sheet music on a song with 2 PDFs, then
  the preferred PDF opens from the device, and I can switch to the other one,
  page through it, and invert colors.
- **B4** Given B2, when I open the sync controls, then they are disabled with
  "Sync sessions need a connection", and no Realtime connection is attempted
  (no WebSocket in the network log).
- **B5** Given B2, then the reorder button, Add PDF, and note editing are not
  offered; keyboard shortcut for reorder is a no-op.
- **B6** Given B3, when I pick a different PDF, then no error toast appears,
  the choice is remembered when I return to that song, and after going online
  and reopening performance mode the server preference matches.
- **B7** Given B2 on song 5 in Sheet music view with the second PDF
  selected, when (a) the app is backgrounded for 10 minutes and resumed, and
  (b) the app is **killed from the app switcher and relaunched** (offline),
  then in both cases performance mode returns to song 5, Sheet music view,
  same PDF. Given the same position saved more than 12 hours ago, then the
  view opens at the first item.
- **B8** Given I am offline and `S2` has **no** snapshot, when I open
  `/setlists/S2/perform` by deep link, then I see "Not available offline" with
  a Back button; no toast, no bounce to `/setlists`.
- **B9** Given `S1` is downloaded with one PDF missing (`partial`), when I
  open that song's sheet music offline, then that PDF is listed as "Not
  downloaded" and the other PDF still opens.
- **B10** Given `S1` is downloaded, when I open it **online**, then it renders
  from the snapshot (`source: "snapshot"`) before any network response, the
  "Offline copy" badge shows, editing actions are available, and a row
  refresh runs in the background with no `/storage/` request.
- **B11** Given `S1` is downloaded and a bandmate reorders it, when I open
  performance mode online, then the new order renders without tapping
  Update, and no `/storage/` request is made.
- **B12** Given I reorder `S1` in performance mode online, then the new order
  persists after leaving and reopening performance mode, both online and
  after going offline with a relaunch.
- **B13** Given `S1` is downloaded and a bandmate adds a PDF to one of its
  songs, when I open `S1` in performance mode online, then the new PDF
  appears in the selector as "Not downloaded", no `/storage/` request is
  made, and `freshness` is `"outdated"`. (Phase 3 adds: the "Update offline
  copy" banner offers to fetch it — see D2.)

### Phase 2 — sign-out and privacy

- **C1** Given `S1` is downloaded, when I sign out **from the user menu**,
  then `listSnapshots()` is empty, the IndexedDB store has no `file:` keys
  and no `last-user`, no `bandmate_perform_position_*` key remains in
  `localStorage`, and the offline home shows nothing after relaunching
  offline.
- **C2** Given user A downloaded `S1`, when user B signs in on the same device
  without A signing out (session replaced), then A's snapshots are wiped before
  B sees any list.
- **C3** Given a PDF was downloaded, then the `supabase-api` Cache Storage
  cache contains no `/storage/v1/` entries.
- **C4** Given `S1` is downloaded, when the token refresh fails with a
  network error while `navigator.onLine` is true (e.g. Wi-Fi connected with
  no upstream, or throttled to drop `/auth/v1/token`), then no snapshot, file
  or `last-user` is deleted, and `S1` is still listed and performs
  (`authMode: "offline-cached"`).
- **C5** Given `S1` is downloaded, when an involuntary `SIGNED_OUT` occurs
  (the refresh returns a non-retryable error, e.g. `/auth/v1/token` answered
  with a 200 HTML page; or `youtubeService.requestAuthorization()` signs out),
  then snapshots are hidden, not deleted (`file:` keys still present), Home
  shows "Sign in again to use your offline setlists" with no setlist names,
  and signing back in as the same user shows `S1` again with no download (no
  `/storage/` request).
- **C6** Given user A's snapshots are hidden (C5), when user B signs in, then
  A's data is wiped before B sees any list (same guarantee as C2).
- **C7** Given the token expired > 1 h ago, when I relaunch offline, then the
  offline home renders within 2 s (A6).

### Phase 3 — update check

- **D1** Given `S1` is downloaded and unchanged, when I go online and open
  its detail, then the badge reads "Available offline" and `freshness` is
  `"fresh"`.
- **D2** Given a bandmate adds a PDF to a song in `S1`, when I go online and
  open the app, then within one check cycle `S1` is "Outdated" in the list,
  and the detail and performance banners read "New sheet music is available
  for this setlist — Update offline copy", with the size to download.
- **D2b** Given a bandmate reorders `S1`, when I go online and open the app,
  then within one check cycle the snapshot's rows are refreshed, `S1` stays
  "Available offline" (`fresh`), no banner shows, and going offline
  afterwards performs the new order.
- **D3** Given a bandmate edits the lyrics of a song in `S1` (after the
  `songs.updated_at` migration), when the check runs, then the new lyrics are
  in the snapshot, that song is in `lastDiff.applied.songsChanged`, and `S1`
  stays `fresh`.
- **D4** Given a bandmate deletes one PDF of a song in `S1`, when the check
  runs, then the id is in `lastDiff.applied.sheetMusicRemoved`, the PDF is
  gone from the selector, its `file:` key is gone after GC (unless another
  snapshot references it), `S1` stays `fresh`, and the check made no
  `/storage/` requests.
- **D5** Given a bandmate deletes `S1`, when the check runs, then the snapshot
  shows "Deleted on server" with only Remove offered, and it still performs
  offline until removed.
- **D6** Given I am offline, when the app starts, then no check runs and the
  freshness shown is the last known one.

### Phase 3 — incremental update

- **E1** Given D2, when I tap "Update offline copy", then the confirmation
  shows exactly the new PDF's size, only that file downloads, and after it
  completes the snapshot is "fresh" and the PDF opens offline.
- **E2** Given a bandmate replaced a PDF (delete + add) in `S1`, when the
  check runs, then the old PDF leaves the selector and its key is gone after
  GC, and `S1` is "Outdated"; when I then update, exactly one file downloads
  and the other files are untouched (`downloadedAt` unchanged).
- **E2b** Given a bandmate renames a PDF of `S1` or changes its page timings,
  when the check runs, then the new name/timings are in the snapshot, `S1`
  stays `fresh`, and a later update downloads nothing for that PDF.
- **E3** Given `S1` and `S3` share a song, when I remove `S3`, then the shared
  PDFs remain and `S1` still performs offline with them.
- **E4** Given an update fails midway (airplane mode during it), then the old
  snapshot still performs offline, the journal resumes when online, and the
  freshness stays "Outdated" until the update commits.

### Phase 3 — management

- **F1** Given two snapshots, when I open Offline setlists, then I see total
  usage, per-snapshot size, saved date, freshness, and Verify/Refresh/Remove.
- **F2** Given I tap Verify offline, then every file is read back and the
  snapshot shows "Verified {now}".
- **F3** Given I tap Remove, then a `ConfirmModal` asks, and after confirming
  the snapshot and its unshared files are gone and usage drops.

---

## 11. Manual device checklist

Run on an iPhone (installed from Safari via Share → Add to Home Screen) and
an Android phone (Chrome → Install). Record OS/browser versions in the PR.

**Install and auth**
- [ ] Install the app; sign in inside the installed app; kill and relaunch: still signed in.
- [ ] iOS: download `S1` in the installed app; open the site in a Safari tab: `S1` is *not* listed there (isolation confirmed) and the hint to use the installed app shows.
- [ ] Turn on airplane mode, wait > 1 h (or set the device clock forward), kill and relaunch: offline home with `S1`.
- [ ] Wi-Fi on but upstream blocked (phone hotspot with no data, or a router with WAN unplugged), token > 1 h old, relaunch: `S1` listed and performs; nothing deleted (C4).
- [ ] Captive-portal Wi-Fi (hotel/venue guest network before accepting), token > 1 h old, relaunch: record whether auth-js removes the session. If it does: "Sign in again…" shows, `S1` hidden but not deleted; after real signal and signing in as the same user, `S1` is back with no download (C5). Also record how long the relaunch spinner lasts: the A6 race applies here too (amended), so with a `last-user` it should end within 1.5 s (§7.1).
- [ ] Connect YouTube (re-auth flow) with `S1` downloaded: `S1` still there afterwards, no re-download.

**Download**
- [ ] Size estimate shown before download matches the sum of PDF sizes within rounding.
- [ ] Progress survives switching to another app and back mid-download.
- [ ] Kill the app mid-download; relaunch online: resumes, does not re-download stored files.
- [ ] Fill the device storage (large video files) until a PDF does not fit: partial result, message names the PDF; free space, Retry: completes.
- [ ] `navigator.storage.persist()` answer shown in management; note the value per OS.
- [ ] Install a build with `OFFLINE_SCHEMA_VERSION` bumped (test build only) over a device with snapshots: the "download these again" notice lists them once; Download works per setlist (A9).

**Perform offline**
- [ ] Airplane mode + relaunch: perform `S1` end to end, both PDFs of a song, page turns, invert, font size.
- [ ] Sync controls disabled with explanation; no error toasts anywhere during the run.
- [ ] Rotate the device and lock/unlock the screen mid-song: same song after unlock.
- [ ] Background for 10+ minutes, resume: same song, view and PDF.
- [ ] **Kill from the app switcher** mid-song (Sheet music view, second PDF), relaunch offline, open `S1` again: same song, view and PDF (A2). Repeat with the device clock moved forward 13 h: starts at the first item.
- [ ] Switch PDFs offline; come online; open performance mode again; check the server preference in another device.

**Perform online with a snapshot**
- [ ] On a laptop, reorder `S1`; on the phone, online, open performance mode: new order without tapping Update; network log shows no `/storage/` request.
- [ ] Reorder `S1` on the phone in performance mode; leave; turn on airplane mode; relaunch; perform: new order.
- [ ] On a laptop, add a PDF to a song of `S1`; on the phone, online, open that song: new PDF shows "Not downloaded".

**Update and management (Phase 3)**
- [ ] Reorder `S1` on a laptop; on the phone, come online: no "Outdated", and going offline afterwards performs the new order.
- [ ] Add a PDF to `S1` on a laptop; on the phone, come online: "Outdated" appears without opening the setlist.
- [ ] Update offline copy: only the new file downloads (watch bytes).
- [ ] Verify after a week without opening the app: still verified (eviction check). Record the result per OS; this is the data point the intent's risk asks for.
- [ ] Sign out from the user menu: management view is empty; relaunch offline: nothing listed; no `bandmate_perform_position_*` keys left (check via remote inspector).

**Service worker**
- [ ] Deploy a new version while performance mode is open online: no reload; leaving performance mode shows the reload banner.
- [ ] Relaunch the installed app offline after that deploy: the old version still opens and performs.

---

## 12. Task breakdown

Each PR is reviewable alone, passes lint + build, and updates docs in the
same PR (CLAUDE.md service/hook tables, README Features, `en.json` +
`es.json`). Order matters within a phase.

Acceptance criteria by PR: A1–A8 → 2.3; A9 → 2.5 (recording in 2.2);
B2–B13 → 2.4 (reached by deep link); B1 → 2.5 (needs `OfflineHome`);
C1–C2, C4–C6 → 2.2a (C5's locked Home copy → 2.5); C7 → 2.2a (`BandContext`
resolves `offline-cached` within 2 s; the offline home itself is checked
again in 2.5); A9 recording → 2.2a (the notice UI → 2.5); C3 → 2.0. 2.2b
owns no criterion on its own: A1–A8 exercise it through 2.3, and it is
verified by unit tests (fake-indexeddb) in `npm test`.

### Phase 2

| PR | Title | Contents | Depends on |
|----|-------|----------|------------|
| 2.0 | Shell hardening for offline | `registerType: 'prompt'` + banner deferred on perform route, worker registered via `workbox-window` so no path reloads on its own; narrow `supabase-api` rule; `useOnlineStatus` hook exposed via `BandContext`; **`getMyBands()` catch + `isResolvingBand` always resolves (§7.2, fixes C3 on its own)**; **precache guard: `maximumFileSizeToCacheInBytes` 5 MiB + `scripts/check-precache.mjs` in `npm run build`**; **Space Grotesk self-hosted (`@fontsource`), fonts precached**. Verify Phase 1 items (§1). No IndexedDB, no code-splitting (follow-up). | Phase 1 |
| 2.1 | Extract performance data loading | `useSetlistPerformanceData` + `PerformanceDataSource` + `networkPerformanceDataSource`; `getSongsByIds`; `getSheetMusicForSongs`; `saveOrder` routed through the hook; view consumes the hook. No offline code. | — |
| 2.2a | Offline store, reads, offline auth | `idb-keyval` dependency; `offlineStore.ts` key layout + store open + schema guard + wipe **with schema-wipe notice record** (A4 lost list exposed by the service; UI in 2.5); `offlineSetlistService`: `openOfflineStore`, `setOfflineCurrentUser`, `getLastUserId`, `confirmSignedInUser`, `listSnapshots`, `getSnapshotMeta`, `getSnapshot`, `getFile`, `listOfflineBands`, `countHiddenSnapshots`, `getSchemaWipeNotice` / `dismissSchemaWipeNotice`, `wipeAll`, `subscribe`/events; reads return empty/null on an empty store and on `storage-unavailable`. `wipeAll` wired to `AuthButton.logout` (awaited before `signOut`) and confirmed user change **only**; also clears `bandmate_perform_position_*` (`performPosition.ts`: prefix + `clearAllPerformPositions`). **`BandContext`: `last-user`, `AuthMode` with `offline-cached` / `session-lost`, involuntary `SIGNED_OUT` → hide (§7.1); offline, `getSession()` raced against a 1.5 s timeout with provisional `offline-cached` from `last-user` and A1 reconciliation (A6, C7); `listOfflineBands` offline branch (§7.2); `isResolvingBand` always resolves; `authMode` exposed.** vitest + fake-indexeddb, `npm test`. No UI beyond what `BandContext` needs, no migration. | 2.0 |
| 2.2b | Download engine | `planDownload`, `downloadSetlist` state machine, journal + `resumeInterruptedDownloads`, `cancelDownload`, quota handling (§4.5), `collectGarbage` (all users' refs), `requestPersistence`, `removeSnapshot`, `listInterruptedDownloads`, `getStorageUsage`; `snapshot-changed` / `download-progress` events; store epoch, cross-tab lock and the other race rules (changelog 2026-09-25, PR 2.2b); dev-only `window.__bandmateOffline`. Unit tests against fake-indexeddb. No UI. | 2.2a |
| 2.3 | "Make available offline" action | Button + confirmation + progress modal (reuse `ConfirmModal` tone/busy; a new `OfflineDownloadModal`) in `SetlistDetailView`, `ShowDetailView` ("Get this show ready offline") and performance mode's top bar; partial/error result view; Remove from detail. Badge in `SetlistList`/detail with saved date. Offline check: after airplane mode + relaunch, 2.2a keeps the user and band (no spinner, no landing) and `listSnapshots()` in devtools still returns `S1`; there is no offline *screen* to open it from until 2.4 (deep link) and 2.5. | 2.2b |
| 2.4 | Perform from the snapshot | `snapshotPerformanceDataSource`; source selection; **`refreshSnapshotRows` + `patchSnapshotSetlist` / `patchSnapshotPreference` (moved from 2.2b), the row refresh after every download commit (§4.3); background row refresh online + re-render; write-through for reorder/preference/upload**; `unavailableSheetMusicIds`; blob URL lifecycle; capabilities gating; offline badge; `SyncControls` disabled state; `usePerformanceSync({ enabled })`; local preference override + flush; **position persistence in `localStorage` (`performPosition.ts`, 12 h expiry, cleared by `wipeAll`)**; error boundary copy. Deep link to `/setlists/:id/perform` works offline (B2–B13) before 2.5. | 2.1, 2.3 |
| 2.5 | Offline entry point (screens) | `OfflineHome` (incl. `session-lost` locked state), `OfflineSetlistList`, `OfflineSetlistDetail`, `OfflineEmptyState`; **schema-wipe notice UI** on Home and the offline list; route wiring for `/`, `/setlists`, `/setlists/:id`; resume + GC at start; generic "needs a connection" fallback for other routes. | 2.4 |
| 2.6 | Docs and i18n sweep | CLAUDE.md (service, hooks, key layout pointer, **wipe rule: only explicit sign-out and user change**, **"bumping `OFFLINE_SCHEMA_VERSION` requires a justification in the PR description"**), README Features ("Perform a setlist offline"), `docs/OFFLINE.md` linking this spec; intent status → "in progress", C5/C6/C11 amendments. | 2.5 |

### Phase 3

| PR | Title | Contents | Depends on |
|----|-------|----------|------------|
| 3.0 | `songs.updated_at` migration | Migration + trigger + `Song.updated_at`; note policies checked; apply to prod before 3.1 ships. | — |
| 3.1 | Fingerprint and update check | `OfflineFingerprint` computed at download; `checkForUpdates` with batching, **calling `refreshSnapshotRows` on mismatch**; freshness from files only + `lastDiff` (`applied` / `filesToDownload` / `filesReleased`) in meta; triggers (start, online, open detail); `verifySnapshot`. | 2.6, 3.0 |
| 3.2 | Outdated / deleted UX | Badge states in list and detail; banners in detail and performance mode with "Update offline copy" (**files only**); "Deleted on server" state. | 3.1 |
| 3.3 | Incremental update | `planDownload({ incremental })` over `lastDiff.filesToDownload`, refcounted GC after commit, old snapshot readable until commit. | 3.2 |
| 3.4 | Offline setlists management | Section in `BandSettings` + user-menu entry; usage/quota/persisted; per-snapshot Verify/Refresh/Remove; interrupted downloads Resume/Discard; schema-wipe notice also shown here; iOS install hint. | 3.3 |
| 3.5 | Docs | CLAUDE.md/README updates; intent status → "shipped (phases 1–3)"; device checklist results recorded in `docs/OFFLINE.md`. | 3.4 |

Not in any PR above (separate intents): backing tracks persistence (Phase 4),
offline access to shows/requests/song library, any editing offline.
