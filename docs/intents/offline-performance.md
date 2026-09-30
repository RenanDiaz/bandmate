# Intent: Offline performance mode

> **Status:** shipped (Phases 1–3), Phase 3 device validation pending — Phase 1 done (2026-09-25); Phase 2 shipped (2026-09-29); Phase 3 shipped (2026-09-30, PRs 3.0–3.4; §11 Phase 3 rows not run yet); Phase 4 is a separate intent · **Created:** 2026-09-24 · **Owner:** Renán Díaz
>
> An *intent* states a problem, the outcome we want and the boundaries of a
> change **before** it is designed in detail. It is the thing a PR points back
> to. It is not a spec: open questions are expected.

## Problem

Venues have bad or no signal. Today Bandmate is "a PWA with offline support"
on paper, but a band cannot reliably run a show from performance mode without
a connection — and PDFs, which matter most on stage, basically never work
offline.

## Intent

A band member can **mark a setlist as available offline ahead of time** and
then, with no connection at all, open it in performance mode and get through
the whole show: songs, lyrics, chords, special items (breaks, sections,
notes) and the sheet music PDFs they use.

Balanced means: explicit and per setlist (the user decides what goes on the
device, and sees how much space it takes), read-only while offline, and no
general offline sync engine.

## Done when

1. From the setlist detail, the show detail (for the show's linked setlist)
   and performance mode there is a **"Make available offline"** action that
   downloads everything that setlist needs and shows progress, size and the
   result.
2. With the device in airplane mode, after a full app restart, the user can
   open the app, go to that setlist and perform it end to end — including
   PDFs — with no errors and no redirect to login.
3. The UI makes the offline state obvious: an offline badge, sync/session
   controls disabled with an explanation, editing actions hidden or disabled.
4. The user can see when the offline copy was saved, whether it is stale
   ("changes since you downloaded"), refresh it, and remove it.
5. Signing out deletes all offline data on the device.
   > Amended 2026-09-29 (spec C11): only a sign-out the user chooses, or a
   > different user signing in, deletes it. A session the app loses on its
   > own (failed token refresh, captive portal, reconnecting YouTube) only
   > **hides** the copies until the same user signs in again.
6. Works on an installed PWA on iOS Safari and Android Chrome (the two stage
   devices that matter), not only on desktop.

## Out of scope

- Creating or joining performance sync sessions offline (needs Realtime).
- Editing anything offline (reordering, notes, songs, uploads) and any write
  queue / conflict resolution.
- Offline access to the rest of the app (songs library, shows, requests…).
- Persisting backing tracks (see *Follow-ups*).

## What we have today, and why it doesn't work

Findings from the code (2026-09-24):

| # | Finding | Effect offline |
|---|---------|----------------|
| 1 | **pdf.js worker loads from unpkg** (`SheetMusicViewer.tsx:11`) — cross-origin, not precached. | The PDF viewer cannot start at all. |
| 2 | **PDF URLs are freshly signed on every view** (`getSheetMusicUrl` → `createSignedUrl`). That is a POST (never cached) and each signed URL carries a new token, so the Workbox cache key never repeats. | PDFs never come from cache, even online-then-offline. |
| 3 | **Auth uses `supabase.auth.getUser()`**, which hits the auth server (`BandContext.tsx:33`, and again inside `getSetlist`). | Offline, `user` resolves to null: the app behaves as logged out. |
| 4 | The Supabase runtime cache is `NetworkFirst`, **1 hour, 100 entries**, shared by every API call, **no `networkTimeoutSeconds`**. | Data expires before the show; with weak (not zero) signal every request hangs until the browser gives up. |
| 5 | Performance mode loads `getBandSongs` (the *whole* band library) plus one `getSheetMusicForSong` per song as you navigate. | Whatever you didn't visit while online isn't there. |
| 6 | The HTTP cache is keyed by URL and ignores the `Authorization` header, and sign-out doesn't clear it. | Privacy issue on shared devices; also fragile to rely on. |
| 7 | Backing tracks are in-memory blob URLs; only the mapping survives a reload. | The user has to re-pick audio files after a restart. |

What already works: the app shell (JS/CSS/HTML) is precached, and SPA
navigation falls back to `index.html`.

## Proposal

### 1. An explicit offline snapshot per setlist

"Make available offline" builds a **snapshot** and stores it on the device:

- **Data (IndexedDB via `idb-keyval`):** the setlist row, *only the songs it references* (not
  the band library), their `song_sheet_music` rows, the user's sheet music
  preferences and preferred instrument, the band's name/avatar, plus
  `userId`, `savedAt` and a content fingerprint.
- **PDFs (Cache Storage or IndexedDB blobs):** keyed by **storage path**
  (`{bandId}/{songId}/{id}.pdf`), never by signed URL. Downloaded through
  a signed URL once, then served locally as a blob URL.

Which PDFs: **all the PDFs of every song in the setlist**, not only the
user's own — on stage anyone may need to switch part. Because that can add up
(PDFs are up to 50 MB each), show the total size before downloading and ask
for confirmation.

Call `navigator.storage.persist()` on the first download and show usage from
`navigator.storage.estimate()`.

### 2. Performance mode reads through a small data source

Add an `offlineSetlistService` (the service layer rule holds: components
don't touch IndexedDB directly) with one entry point used by performance mode:

- **Snapshot exists:** render from it immediately (instant, immune to bad
  signal).
- **No snapshot:** current behavior (network), with a short timeout.

### 2b. Update check (notify, don't auto-download)

> Amended 2026-09-25: data rows now refresh automatically when online; only
> PDFs follow the notify rule below (see *Decisions*).

Whenever there is a connection — app start, coming back online, opening a
downloaded setlist — compare each snapshot's fingerprint against the server
(setlist `updated_at`, the referenced songs and their `song_sheet_music`
rows). This is a few small queries; it never downloads PDFs by itself.

If something changed, the offline copy is marked **outdated** and the user
sees it: a banner in the setlist detail and in performance mode ("This
setlist changed since you downloaded it — Update offline copy"), and an
"Outdated" state on the offline badge in lists. Updating is one tap and only
re-downloads what changed (new or replaced PDFs, changed rows); removed PDFs
are deleted.

> Amended 2026-09-30 (spec, PRs 3.1–3.3): only **new PDFs** make a copy
> "Outdated" (row changes are applied on their own, see above). The detail's
> notice reads "New sheet music is available for this setlist: N PDFs to
> download" (the size shows in the confirmation: the check never touches
> Storage); performance mode shows an "Update offline copy" button, not a
> banner. A setlist deleted on the server shows "Deleted on server" and
> still performs until removed.
The PDF viewer receives a local blob URL when the file is in the snapshot,
and a signed URL otherwise.

### 3. Make the shell survive offline

Needed regardless of the feature, and cheap:

- Bundle the pdf.js worker locally (`new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`)
  so it is precached.
- Auth: offline, resolve the user from the locally stored session
  (`getSession()`) instead of `getUser()`, and don't send the user to login
  when offline with a known session. An expired token offline still allows
  opening snapshots saved by that same `userId`.
- Add `networkTimeoutSeconds` (≈3–4 s) to the Supabase `NetworkFirst` rule so
  weak signal falls back instead of hanging.
- Stop relying on the Workbox API cache for auth-scoped data for this feature
  (the snapshot is the source of truth).

### 4. Offline UX in performance mode

- A `useOnlineStatus` hook (`online`/`offline` events + failed-request
  signal; `navigator.onLine` alone lies).
- Offline badge in the header. `SyncControls` disabled with "Sync sessions
  need a connection". Reorder / upload / edit notes disabled.
- Selecting a different PDF offline works locally (only among downloaded
  ones); the preference is saved to the server next time we are online, best
  effort.
  > Amended 2026-09-29 (spec C5): that choice is the one bounded offline
  > write. It is kept on the device and sent when online, never with an error
  > toast; nothing else is queued.

### 5. Managing offline setlists

- Setlist list/detail: an "Available offline" badge with the date.
- A small "Offline setlists" section (band settings or user menu) listing
  snapshots, size, *Refresh* and *Remove*.
- Sign-out wipes all snapshots and offline PDFs.

> Amended 2026-09-29 (spec C6): offline, the app needs a way to *reach* a
> snapshot, so Phase 2 ships an offline home (the saved setlists, a read-only
> setlist view, Perform). The management section above stays in Phase 3.
>
> Amended 2026-09-30 (spec, PR 3.4): "Offline setlists" is its own page,
> `/offline`, reached from the user menu, not a band settings section (band
> settings is per band, online only and for owners and admins). It works
> offline, lists every band's copies with size, dates and state, and offers
> Verify, Update and Remove, plus storage used and whether the browser
> protects it.

## Phases

1. **Foundations (no new UI):** local pdf.js worker, offline-safe auth,
   network timeout. Worth shipping on its own. ✅ Done (2026-09-25).
2. **Snapshot + performance mode offline:** download action, data source,
   offline UX, sign-out wipe. This is the phase that makes it possible to do a
   show with no connection. ✅ Shipped (2026-09-29, PR 2.6 removed the flag).
3. **Update check and management:** fingerprint check, "outdated" notice,
   incremental update, offline setlists list. ✅ Shipped (2026-09-30,
   PRs 3.0–3.4); device checklist pending (`docs/OFFLINE.md`).
4. **Follow-ups (separate intents):** persist backing tracks in
   IndexedDB/OPFS so they survive a restart.

## Risks

- **iOS storage eviction.** Safari can evict data for sites that aren't used
  for a while; installed home-screen PWAs fare better and `persist()` helps
  but isn't guaranteed. Mitigation: tell users to install the app, and show
  "Offline copy verified" state that they can check the day of the show.
- **Quota.** Many large PDFs can exceed the quota, especially on iOS. Handle
  `QuotaExceededError` per file and report what didn't make it.
- **Stale content on stage.** Someone edits the setlist after I downloaded.
  Accepted: the snapshot wins offline, and the "outdated" notice appears as
  soon as there's a connection (see 2b).
- **Performance mode is a 2.9k-line component.** Swapping its data loading
  should be done by extracting the loading logic first, not by adding more
  branches inline.

## Decisions

- **PDFs:** download all the PDFs of every song in the setlist. (2026-09-24)
- **Updates:** data rows refresh automatically when online; PDFs are never
  downloaded automatically — the user is notified and decides. (2026-09-24;
  amended 2026-09-25: originally rows also waited for the user, which made a
  user's own online edits "disappear" from a downloaded setlist. See the
  spec's A3.)
- **Guests** can make setlists available offline — it's read-only. (2026-09-24)

- **Show detail** also offers "Get this show ready offline", which downloads
  the setlist linked to that show (same snapshot as from setlist detail).
  (2026-09-24)
- **IndexedDB** through `idb-keyval` (new dependency, ~1 KB). (2026-09-24)

## Open questions

None for now.
