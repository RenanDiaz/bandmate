# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev      # Start dev server at http://localhost:5173
npm run build    # tsc -b, SSR pass, client build, precache check (see below)
npm run lint     # ESLint check
npm test         # Vitest unit tests (node + fake-indexeddb)
npm run preview  # Preview production build locally
npm run og       # Regenerate public/og-image.png (needs sharp)
npm run icons    # Regenerate the PWA icons (needs sharp)
npm run vapid-keys # Print a new VAPID key pair for push (docs/setup/push-notifications.md)
```

Local Node: 22 (`.nvmrc`, for `nvm use`; Vercel ignores it). There is no
`package.json` `"engines"` on purpose: it would override the Vercel project's
Node.js setting (Settings → Build and Deployment), which decides the
production runtime. Pin `engines` only to the version that setting shows.

`npm run build` runs four steps: `tsc -b`, an SSR build of
`src/entry-server.tsx` into `dist-ssr/`, the client build, which injects the
prerendered landing into `index.html`, and `scripts/check-precache.mjs`. Use
`npm run build` rather than a bare `vite build` — the latter still succeeds but
ships an empty shell. See [docs/guides/landing-seo.md](docs/guides/landing-seo.md).

`scripts/check-precache.mjs` fails the build when any `.js`/`.mjs`/`.css`/`.html`
file in `dist/` is missing from the service worker's precache manifest (the
app would not start offline). If it fires, look at `globPatterns`,
`globIgnores` and `maximumFileSizeToCacheInBytes` (5 MiB; the main bundle is
≈2 MB) in `vite.config.ts` — don't delete the check.

## Project Overview

**Bandmate** is a band management web application that helps musicians manage songs, setlists, shows, rehearsals and collaborate with band members. Built as a PWA for offline support. Deployed on Vercel at `www.bandmate.space`.

**Tech Stack**:
- React 19 + TypeScript
- Vite 6 with PWA support (vite-plugin-pwa/Workbox)
- Supabase (auth, database, real-time, storage, Edge Functions)
- Bootstrap 5 + Reactstrap + Styled Components
- React Router v7
- i18next for internationalization (English/Spanish)
- dnd-kit for drag-and-drop

## Architecture Overview

### Directory Structure

```
src/
├── components/        # React components (views, modals, forms); AppNavbar = the header (see "Header")
├── context/           # React Context: BandContext (global state), ToastContext (notifications), offlineAuthController (auth modes), offlineDownloadController (running offline download + results)
├── hooks/             # Custom hooks (useSetlistPerformanceData + performanceDataController, performanceTarget, performanceDataSource, snapshotPerformanceDataSource, songPerformanceDataSource, usePerformItems; usePerformanceSync, useLocalBackingTracks, useOnlineStatus, useOfflineDownload, useOfflineStartup, useSetlistTextExport, useInputCapabilities, usePickerState, useSortableSensors, useOpenInBand, useBandFromQuery)
├── i18n/              # i18next setup + locales/{en,es}.json
├── lib/               # Utilities (supabaseClient, authSession, networkErrors, backingTrackEngine, offlineStore, offlineDownloadUi, platform, pwaUpdates, pushSupport, wakeLock, performPosition, pdfWorker, BandStorage, siteConfig, transposition, dates, calendar export)
├── services/          # Supabase + external API data access layer
├── styles/            # CSS design tokens
├── test/              # Vitest setup and fixtures (tests live next to code in __tests__/)
├── utils/             # Pure helpers (songFilters, songSignals, setlistInsert, setlistMove, deepEqual, performItems, setlistText, upcomingEvents, bandColors, bandSwitch)
├── theme.ts           # Styled Components theme
├── entry-server.tsx   # Build-time SSR entry for the landing page
├── App.tsx            # Root component: providers, theme attribute, invite redirect, <AppNavbar />, footer
├── AppMain.tsx        # Auth/band gates and <Routes> (offline screens, §7.3)
└── main.tsx           # Entry point
supabase/
├── functions/         # Edge Functions (Deno)
└── migrations/        # Supabase CLI migrations (new migrations go here)
migrations/            # Legacy SQL, applied manually — historical reference
```

### Key Architectural Patterns

**State Management**: Uses React Context (`BandContext`) as the central state store. Access via `useBandContext()` hook. The context manages:
- Authentication state (user)
- Selected band and band list
- Band selector visibility

**Service Layer** (`src/services/`): All Supabase interactions go through service modules. Components should not call `supabase` directly.

| Service | Domain |
|---------|--------|
| `bandsService.ts` | Bands; membership via the `band_members` join table |
| `bandMembersService.ts` | Member invitations and roles (owner/admin/member/guest) |
| `bandAvatarStorageService.ts` | Band avatar uploads (Supabase Storage) |
| `songsService.ts` | Songs scoped to bands; `getSongsByIds(ids)` fetches only the given songs (performance mode) |
| `songSheetMusicService.ts`, `sheetMusicStorageService.ts` | Sheet music PDFs per song (table + Storage), band-wide order via `position`; `getSheetMusicForSongs(ids)` loads several songs in one `.in()` query, grouped by song; `listSheetMusicFolderSizes` / `createSheetMusicDownloadUrl` size and fetch files for offline downloads |
| `sheetMusicPreferencesService.ts` | Per-user preferred PDF per song (`user_sheet_music_preferences`) + device-local preferred instrument |
| `setlistsService.ts` | Setlists with embedded song references (JSONB `songs` column) |
| `showsService.ts` | Show/gig scheduling; `getUpcomingShowsForBands(ids)` loads several bands' upcoming shows in one `.in("band_id")` query (`[]` without a round-trip for no ids) |
| `rehearsalsService.ts` | Rehearsal scheduling; `getUpcomingRehearsalsForBands(ids)`, same shape |
| `requestsService.ts` | Band requests/proposals with comments and votes |
| `reportsService.ts` | Band reports/statistics |
| `calendarSubscriptionService.ts` | Per-user iCal feed subscriptions (served by the `calendar-feed` Edge Function): shows/rehearsals toggles, time zone, one-tap subscribe links (`webcal://`, Google, Outlook.com) |
| `performanceSessionService.ts` | Real-time sync sessions using Supabase Realtime |
| `pushSubscriptionService.ts` | Push notifications: this browser's subscription row (`savePushSubscription` → `register_push_subscription` RPC, `deletePushSubscription`, `hasPushSubscription`, `updatePushSubscriptionLocale`) and per-band mutes (`getMutedBandIds`, `setBandMuted`). Browser side: `src/lib/pushSupport.ts`, see "Push notifications" |
| `offlineSetlistService.ts` | Offline copies of setlists in IndexedDB (via `src/lib/offlineStore.ts`): reads filtered by the current user (`prefetchOfflineReads` warms the list during the A6 race), `confirmSignedInUser`, `wipeAll`, schema-wipe notice, events; downloads (`planDownload`, `downloadSetlist`, `resumeInterruptedDownloads`, `cancelDownload`, `removeSnapshot`, `collectGarbage`, `requestPersistence`, `listInterruptedDownloads`, `getStorageUsage`). perform mode (PR 2.4): `refreshSnapshotRows`, `patchSnapshotSetlist`, `patchSnapshotPreference`, `recordLocalPreference`, `flushLocalPreferences`, `markSnapshotFileMissing`. See "Offline store", "Offline downloads" and "Offline download UI" below |
| `groqService.ts`, `aiSetlistService.ts` | AI setlist generation/optimization (Groq) |
| `spotifyService.ts`, `musicBrainzService.ts`, `metadataService.ts`, `lyricsService.ts`, `youtubeService.ts` | External metadata/lyrics integrations |

**Routing Pattern**: Protected routes show `BandSelector` overlay when user is logged in but no band is selected.

| Route | Description |
|-------|-------------|
| `/` | Landing (logged out) / dashboard (logged in), plus My upcoming events across bands when in 2+ bands |
| `/login` | Login |
| `/songs` | Song library (requires auth + band) |
| `/songs/print` | Printable songbook |
| `/songs/:songId/perform` | Performance mode for one song (online only) |
| `/setlists` | Setlist management |
| `/setlists/:setlistId` | Setlist detail view |
| `/setlists/:setlistId/edit` | Setlist editor with drag-drop |
| `/setlists/:setlistId/perform` | Performance mode (fullscreen lyrics) |
| `/setlists/:setlistId/print` | Printable setlist |
| `/shows` | Show scheduling |
| `/shows/:showId` | Show detail view |
| `/rehearsals` | Rehearsal scheduling |
| `/rehearsals/:rehearsalId` | Rehearsal detail view |
| `/requests` | Band requests/proposals |
| `/requests/:requestId` | Request detail (comments, votes) |
| `/bands/:bandId/settings` | Band settings/members panel |
| `/invite/accept` | Invitation acceptance flow |
| `/about` | About page |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |

Unknown paths redirect to `/`. The source of truth is the `<Routes>` block in `src/AppMain.tsx`. Offline, most
routes render a fallback instead (see "Offline screens").

**Header** (`src/components/AppNavbar.tsx`,
[docs/specs/app-header.md](docs/specs/app-header.md)). Desktop and offcanvas
render from one `NAV_LINKS` array (`src/components/navLinks.ts`); the active
rule lives only in `isNavLinkActive`. The desktop layout starts at `lg`
(992 px): its `max-width` queries use `theme.breakpoints.lgDown` (991.98 px),
never `lg`, or both layouts apply at exactly 992 px. Home is offcanvas-only
(the logo is the home link on desktop). About is not a nav link: it is
reached from the footer and the user menu.

### Data Flow

1. User authenticates via OAuth (GitHub/Google) through Supabase Auth
2. `BandContext` loads user's bands via `band_members` table (not `bands.owner_id`)
3. Selected band ID persists to localStorage via `BandStorage` utility
4. Components fetch band-scoped data (songs, setlists, shows) using the selected band ID

**Opening a page of another band** (`useOpenInBand()`, `src/hooks/`): the
detail views take role and header from `selectedBand`, so a link into band B
while A is selected must switch first. The hook calls `setSelectedBand(B)`
(only when it differs), then `navigate(path)` in the same handler (one React
batch; never move the navigate into an effect), then an info toast
`home.switchedToBand`. An unknown band id navigates without switching.
Upcoming shows and rehearsals are merged and sorted by `mergeUpcomingEvents`
(`src/utils/upcomingEvents.ts`: date, then time with no time last, then band
name, then name; date strings compared as strings, never through
`new Date()`), with `eventPath` / `eventLink` for their routes. The dashboard's
row is `UpcomingEventRow` (`src/components/home/`): two lines, a date block
(weekday, day, month) and one meta line (band · type · place · time ·
countdown, amber only within `SOON_DAYS`), the Setlist / Show chip on the
right (under the meta line below `md`). In `MyUpcomingEvents` the date block
takes the band's colour (`bandColorMap`, `src/utils/bandColors.ts`: one
`BAND_COLORS` entry per band by ascending id, wrapping after eight); without
`bandColor` it is purple for a show, cyan for a rehearsal. `Home` renders the greeting first,
then, with two or more bands, `MyUpcomingEvents` (same folder), then the band
section headed by the band's name. `MyUpcomingEvents` has its own effect keyed by
the sorted band ids (a `refreshBands()` with the same bands doesn't refetch),
both `ForBands` reads, six rows then "Show all", a band chip on every row, and
row / Setlist / Show chip taps through `useOpenInBand`. Its load failure is an
inline line + Retry: no toast and no `reportNetworkFailure()` (the band
dashboard is the only reporter). Not rendered offline or in `session-lost`.

**`?band=<id>` on any route** (`useBandFromQuery()`, called in `AppMain`; a
tapped push notification opens `/shows/:id?band=7`): once auth and bands have
resolved it selects that band with the same rule as `useOpenInBand`
(`bandToSwitchTo`, `src/utils/bandSwitch.ts`: only when it differs, unknown
id → no switch), drops the param with a `replace` (path and other params
kept) and toasts `home.switchedToBand`. While it is pending `AppMain` renders
its spinner, so no frame of the page shows the old band.

### Offline-safe auth

`supabase.auth.getUser()` asks the auth server, so offline it returns no user.
`BandContext` and the paths performance mode depends on (`getSetlist`,
`getMyBands`, `getUserBandRole`, `setMySheetMusicPreference`,
`usePerformanceSync`, `AuthButton`) use the locally stored session instead:
`getSessionUser()` in `src/lib/authSession.ts`.
New read paths that must work offline should do the same. The Supabase runtime
cache uses `NetworkFirst` with `networkTimeoutSeconds: 4`, so on weak signal it
falls back to the cache instead of hanging. That rule matches only
`/rest/v1/` and `/auth/v1/`; Storage (`/storage/v1/`, PDFs) is never cached by
the service worker. See
[docs/intents/offline-performance.md](docs/intents/offline-performance.md).

**Auth modes** (`src/context/offlineAuthController.ts`, spec §7.1). `BandContext`
owns one `OfflineAuthController` and exposes `authMode` next to `user`:

| `authMode` | When | `user` | Offline copies |
|------------|------|--------|----------------|
| `session` | valid session | Supabase `User` | that uid's, visible |
| `offline-cached` | `getSession()` failed with `AuthRetryableFetchError` (or didn't answer within 750 ms, online or offline) and `last-user` exists | `OfflineUser` (`{ id, offlineCached: true }`) | `last-user`'s, visible |
| `session-lost` | no stored session / involuntary `SIGNED_OUT`, `last-user` exists | `null` | hidden, **not** deleted |
| `signed-out` | no session, no `last-user` | `null` | none |

- `user` is typed `AppUser = { id } & Partial<Omit<User, "id">>`: only `id` is
  guaranteed and every other field is optional, so the compiler makes you
  handle `offline-cached`. Hide what isn't there (`AuthButton` shows "Offline"
  instead of an email). Read the user from `useBandContext()`, not from a
  second `getSession()`.
- **`getSession()` is not awaited when `last-user` exists** (A6, online or
  offline: weak signal reports online): with an expired token it takes ≈25 s
  to fail. It is raced against `GET_SESSION_OFFLINE_TIMEOUT_MS` (750 ms), and
  `last-user`'s snapshot list is read in parallel (`prefetchOfflineReads`,
  used only once that uid is current) so the offline home renders right after;
  on timeout `last-user` resolves `offline-cached` **provisionally**, and the
  late answer reconciles (same uid → `session`; other uid → wipe, then
  `session`; retryable error → stay; other `null` → `session-lost`).
- A provisional or cached state never runs confirmed-state side effects: no
  `confirmSignedInUser`, no wipe, no `last-user` write, no
  `BandStorage.clearSelectedBandId()`.
- `last-user` (IndexedDB) is written only by `confirmSignedInUser()` on a
  **confirmed** session (`getSession()` / an auth event carrying a session).
- Back online in `offline-cached`, `BandContext` calls `recheck()`.
- Bands (`src/context/bandResolution.ts`, §7.2): `getMyBands(userId)` with a
  session; `listOfflineBands()` in `offline-cached` or when `getMyBands()`
  fails with a **network** error (`isNetworkError`, `src/lib/networkErrors.ts`).
  An HTTP error keeps the no-band UI, with no fallback. `getMyBands` takes the uid
  from the context and never reads the session again. `isResolvingBand`
  always ends.

**Offline wipe rules — exactly two triggers** (spec §3.5 #6). `wipeAll()` clears
the IndexedDB store (`last-user` included) and every
`bandmate_perform_position_*` localStorage key. It runs **only**:
1. on user-initiated sign-out: `AuthButton.logout` calls
   `performUserSignOut(wipeAll, signOutEverywhereOrLocally)`, which awaits the
   wipe **before** signing out and marks the resulting `SIGNED_OUT` as
   voluntary. `signOutEverywhereOrLocally()` (`src/lib/authSession.ts`) removes
   the local session when the server can't be reached (offline, network error,
   > 3 s): auth-js `signOut()` keeps it on a network error, for every scope;
2. inside `confirmSignedInUser(uid)` when `uid` differs from `last-user`,
   before that uid becomes current.

Never wipe on a `null` session, on an involuntary `SIGNED_OUT` (failed refresh,
another tab, `youtubeService.requestAuthorization()`) or on a provisional
state — those **hide** (`setOfflineCurrentUser(null)`). Don't add a third
caller.

### Offline store

`src/lib/offlineStore.ts` is private to `offlineSetlistService` (components and
hooks never import it or `idb-keyval`). One database `bandmate-offline`, one
store `kv`, prefixed keys: `meta`, `last-user`, `schema-wipe-notice`,
`band:{id}`, `snapshot-meta:{setlistId}`, `snapshot:{setlistId}`,
`file:{storagePath}`, `download:{setlistId}` (layout: spec §3.3).

- Every read filters by the id set with `setOfflineCurrentUser(id, {
  authenticated })`; `null` returns empty/null. `authenticated` is `true` only
  in `authMode: "session"` (the controller sets it); downloads need it. Reads never throw: an empty store and
  `storage-unavailable` (no IndexedDB, open fails) both return empty/null;
  only `openOfflineStore()` rejects, with `OfflineError("storage-unavailable")`.
- `meta.schemaVersion !== OFFLINE_SCHEMA_VERSION` (or a record of another
  version) wipes the store, keeps `last-user`, and records the lost setlists
  in `schema-wipe-notice` (`getSchemaWipeNotice()` / `dismissSchemaWipeNotice()`).
  Dismissing removes the current user's entries and the key goes when none are
  left (no per-user dismissal list: the store holds one user's data, A1).
  `wipeAll()` deletes it too: it names setlists.
  **Bumping `OFFLINE_SCHEMA_VERSION` deletes every offline copy on every
  device: justify it in the PR description.** Old `snapshot-meta` records must
  keep `setlistId`, `setlistName`, `userId`, `bandId` (the one cross-version
  contract).

### Offline downloads

`planDownload(id)` fetches rows, sizes each storage folder (`list()`,
concurrency 4) and marks files already in the store (by storage path) —
no writes. `downloadSetlist(plan)` writes the journal `download:{id}` first,
fetches files **one at a time** (a 60 s no-progress timeout per file,
`src/lib/offlineFetch.ts`), then commits meta + snapshot + band and deletes
the journal in one transaction. Pre-conditions reject (`OfflineError`:
`not-authenticated`, `offline`, `plan-stale` — plan > 10 min or not from this
page, `download-in-progress`, `storage-unavailable`); per-file failures,
quota, cancel and interruptions are **returned** in `DownloadResult`. Rules
that keep it correct (spec changelog, PR 2.2b) — keep them when changing it:

1. **Wipe during a download.** Every download write goes through
   `transact(..., { epoch })`, which reads `meta.epoch` in the same
   transaction and writes nothing if a clear (`wipeAll`, schema wipe, any tab)
   replaced it. A local wipe also aborts the running fetch. Never write a
   download record with plain `writeKey`/`writeMany`.
2. **Auth drops.** Before each file **fetch** the owner must still be the
   `authenticated` current user and `navigator.onLine` not `false` (never the
   context's `isOnline`: its forced-offline window would skip every
   remaining file after one failure; one file's network error only marks that
   file). Otherwise the rest is recorded as `network` and the journal stays
   for `resumeInterruptedDownloads()`. The **commit** is local: it needs only
   an unchanged epoch and the plan's owner as current uid, so it runs offline
   and in `offline-cached`; `session-lost` or another uid commits nothing. A
   resume with every file stored commits offline too.
3. **GC** (`collectGarbage`) is one readwrite transaction and keeps every file
   any `snapshot:` or `download:` record references, **whatever its
   `userId`**, plus the running job's files. It is the only thing that deletes
   `file:` keys besides `wipeAll`.
4. **One download per device**: an in-tab claim plus the Web Lock
   `bandmate-offline-download` (`ifAvailable`); without Web Locks only the
   in-tab claim holds.

Quota (§4.5): a file that fails with `QuotaExceededError` (also Safari's
aborted-transaction form, `isQuotaExceeded`) is recorded as `quota` and only
smaller files are tried after it; a commit that doesn't fit is retried once
after GC, then returned as `failed` / `quota-rows`. Tests inject quota with
`__setWriteFaultForTests` (fake-indexeddb has none).

### Offline download UI

No feature flag: the offline UI shipped to everyone in PR 2.6 (after the §11
device checklist). Short entry point: [docs/OFFLINE.md](docs/OFFLINE.md).

"Make available offline" (PR 2.3) lives in `src/components/offline/`:
`OfflineDownloadAction` (variants `setlist`, a link-style action rendered
inside `OfflineStatusRow`, `show` in `ShowDetailView` for the linked setlist,
`toolbar` in performance mode's top bar), `OfflineStatusRow` (setlist detail,
under the title: the one line for the setlist's offline state — the
`setlist` action / progress / Retry, badge, Remove, interrupted notice with
Resume/Discard; see
[docs/specs/setlist-actions-layout.md](docs/specs/setlist-actions-layout.md) §2.5),
`OfflineBadge` (also in `SetlistList`),
`OfflineDownloadModal` and the presentational `OfflineDownloadBodies`. The
plan → confirm → progress flow is `useOfflineDownloadFlow` (its own file,
also used by the schema-wipe notice's Download buttons).

- **One owner for the running download:** `offlineDownloadController`
  (`src/context/`, plain TS, read with `useOfflineDownloadState()`) holds the
  promise, latest progress and each setlist's last result, so the modal
  re-attaches after navigation (A4). Start downloads through it
  (`start(plan, name)`), never by calling `downloadSetlist` from a component.
  It also holds a Screen Wake Lock (`src/lib/wakeLock.ts`) while a download
  runs and bumps `revision` when the page becomes visible again.
- **Every role** sees and can use the action (A7); it is disabled with "Needs
  a connection" unless online with `authMode: "session"` (A8).
- **Remove only in the setlist detail** — never in the toolbar variant
  (performance mode renders from the snapshot from 2.4 on).
- The confirmation reuses `ConfirmModal` (`children` slot); on iOS it says
  "Saved on this device, in this app" and, in a browser tab
  (`src/lib/platform.ts`), shows the install hint (§9.1).
- **App start:** `useOfflineStartup()` (called in `AppContent`) runs
  `resume()` then `collectGarbage()` once the user is known (`session` or
  `offline-cached`) and again when the connection returns.

### Offline screens (PR 2.5)

Routing lives in `src/AppMain.tsx` (extracted from `App.tsx`; the navbar is
`src/components/AppNavbar.tsx`). **"Offline" is `useOfflineUi()`**: a user known (`session`
or `offline-cached`) and the context's `isOnline` false, which includes
`reportNetworkFailure()`'s forced-offline window. `<OfflineAware offline={…}>` renders
the offline screen *instead of* the online view (the online view is not
mounted: no fetches, no toasts); when `isOnline` returns, the same URL renders
its online view again. Nothing navigates. Spec §7.3.

| Route offline | Renders |
|---------------|---------|
| `/` | `OfflineHome`: schema-wipe notice, the selected band's snapshots (`OfflineSetlistList`), interrupted downloads. No dashboard fetch |
| `/setlists` | `OfflineSetlistsPage` (notice + the same list) |
| `/setlists/:id` | `OfflineSetlistDetail` from `getSnapshot` (items, PDF counts, badge, Perform), or "Not available offline" |
| `/setlists/:id/perform` | unchanged: the snapshot source (§8.2) |
| `/login`, `/about`, `/privacy`, `/terms` | unchanged |
| every other route | `NeedsConnection` ("This page needs a connection" + link home) |

- **Band gate offline:** `BandSelector` is never shown. No local bands →
  `OfflineEmptyState`; several and none selected → `OfflineBandPicker`.
- **`session-lost`:** `BandContext.hiddenOfflineCount` (via `getLastUserId` +
  `countHiddenSnapshots`, only in that mode) makes `Home` render
  `OfflineLockedHome` ("Sign in again…", a count, no names), online or offline.
- **Schema-wipe notice** (`SchemaWipeNotice`, A4): online dashboard, offline
  home and offline list. A row's successful download (or `setlist-not-found`)
  dismisses that entry; Dismiss clears them all.
- **Weak signal:** `Home`, `SetlistsView` and `SetlistDetailView` call
  `reportNetworkFailure()` when their load fails with `isNetworkError`; the
  gate then shows the offline screen. HTTP errors keep the old behaviour.
  Detail skips its toast + bounce only in that case.
- `BandAvatar` shows the band initial when the image fails to load
  (offline `/storage/v1/` is never cached).
- Offline screen data hooks: `useOfflineSnapshotList`, `useOfflineSnapshot`,
  `useInterruptedDownloads`, `useSchemaWipeNotice` (`src/hooks/useOfflineDownload.ts`).

**Dev hook:** in `npm run dev`, `window.__bandmateOffline` exposes
`planDownload`, `downloadSetlist`, `download(id)`, `listSnapshots`,
`getStorageUsage`, `listInterruptedDownloads`, `resumeInterruptedDownloads`,
`cancelDownload`, `removeSnapshot`, `collectGarbage`, `getFile`
(`src/lib/devOfflineHook.ts`, loaded from `main.tsx` behind
`import.meta.env.DEV`; production builds contain no reference to it — keep it
that way).

**Online status** (`useOnlineStatus` hook): `navigator.onLine` plus the
`online`/`offline` events, and `reportNetworkFailure()`, which forces offline
after a failed request (captive portals, signal with no data): 30 s, doubling
on each consecutive failure up to 5 min (failures inside a running window
don't escalate). **Pair every `reportNetworkFailure()` site with
`reportNetworkSuccess()` on success**: it resets the backoff (it does not end a
running window; a service-worker cache answer looks like a success). A real
`online` event ends the window and resets too. Read them from
`useBandContext()` (`isOnline`, `reportNetworkFailure`, `reportNetworkSuccess`)
so the whole tree shares one value; don't call the hook again elsewhere.
`BandContext` reports `getMyBands()` network failures (not HTTP errors) and
successes, and always ends band
resolution so a failed load renders the no-band UI instead of a spinner.

**Account menu** (`src/AuthButton.tsx`, one component, two layouts). In the
desktop bar it is `variant="dropdown"` with `compact`: a trigger with the avatar
(no email; the open menu shows it) opens a floating menu (closed by Escape, a
click outside or the trigger). In the mobile drawer (`CustomOffcanvas`) it is
`variant="inline"`: the same content as flat rows of the drawer (account
header, Language, About, Notifications, Check for updates, Sign out) with
`onAction` closing the drawer. Notifications shows only with
`isPushNotificationsEnabled()`, in `session` and online; it opens the modal
through `notificationSettingsStore`, rendered by `NotificationSettingsHost`
in `App` (a modal inside the drawer would unmount with it). About (`/about`) shows in `session` and `offline-cached`. Never render a floating menu inside the drawer:
anchored to its last row it opens below the viewport. Tests:
`src/__tests__/AuthButton.test.tsx`, header: `src/components/__tests__/AppNavbar.test.tsx`.

**Service worker updates** use `registerType: 'prompt'`. `PwaUpdater`
(`src/lib/pwaUpdates.ts`, plain TS, unit-tested; one instance via
`getPwaUpdater()`) registers the worker with `workbox-window` and owns the
"new version waiting" state; `PwaReloadPrompt` renders it and reloads only when
the user taps Reload; the prompt is hidden on the perform routes until the user
leaves. An installed iOS app resuming from the background doesn't navigate, so
the browser never looks for a new worker: `checkOnResume()` calls
`registration.update()` on `visibilitychange` → visible and on `online`, at
most once a minute. The user menu's **Check for updates** (`AuthButton`) calls
`checkForUpdate()` and, when a version is ready, `applyUpdate()` (a user
gesture, so it reloads right away). Never add `skipWaiting`, `clientsClaim` or
an automatic reload. The
brand font (Space Grotesk 700) is self-hosted via `@fontsource/space-grotesk`
and precached with the other `woff2` files. `bootstrap-icons.css` requests its
font with a `?<32-hex>` cache-busting key, which `ignoreURLParametersMatching`
strips so the precache matches offline (without it every icon is blank).

### Push notifications

Band push notifications ([docs/specs/band-push-notifications.md](docs/specs/band-push-notifications.md),
setup: [docs/setup/push-notifications.md](docs/setup/push-notifications.md)).
Server side: triggers → `notification_events` → `send-push-notifications`
(see "Edge Functions"). Client side, behind `isPushNotificationsEnabled()`
(`VITE_PUSH_NOTIFICATIONS=true` or `localStorage.bandmate_flag_push = "1"`,
which devices without a console set by opening any page with `?flag=push`
(`?flag=-push` clears it; `applyFlagParams`, called in `main.tsx`, drops the
param before the first render); the flag hides UI only):

- **Worker:** `public/push-sw.js` (`push` → always a notification, even for
  an unreadable payload — browsers require it; `notificationclick` →
  same-origin URLs only, focus + `navigate()` an open window, else
  `openWindow`). The Workbox worker loads it with `workbox.importScripts`,
  **build only** (the dev worker is an ES module, where `importScripts`
  throws): try push with `npm run build && npm run preview`. Keep it a
  dependency-free classic script, with no fetch handling and no
  `skipWaiting` / `clientsClaim`. Tested from
  `src/lib/__tests__/pushServiceWorker.test.ts` against a fake `self`.
- **This device:** `src/lib/pushSupport.ts` (plain TS, injectable `PushEnv`):
  `getPushStatus` (`needs-install` for iOS in a browser tab: Web Push is
  installed-app only), `subscribeThisDevice(locale)` — call it straight from
  the tap, the permission prompt is its first await (iOS needs the gesture) —,
  `syncThisDevice` (only when the settings open, **never on app start**: it
  would subscribe whoever signed in next on a shared browser),
  `updateThisDeviceLocale` (language change in the user menu) and
  `unsubscribeThisDevice`. It uses the registration PwaUpdater made and never
  registers a worker.
- **Sign-out** (user-initiated only) clears the device first:
  `AuthButton`'s `clearDeviceBeforeSignOut` runs `wipeAll()` and
  `unsubscribeThisDevice()` as `performUserSignOut`'s wipe step. It is the
  same trigger as the offline wipe, not a new one.
- **UI:** `src/components/notifications/` — `NotificationSettingsBody`
  (presentational, static render tests), `NotificationSettingsModal`
  (this device on/off, one switch per band = `band_notification_mutes`),
  `NotificationSettingsHost` (in `App`; closes when the session or the
  connection goes) and `notificationSettingsStore`.
- The push texts are server-side (`_shared/pushMessages.ts`, by the
  subscription's `locale`: created, moved, cancelled), not in `en.json` /
  `es.json`.

### Performance data

`PerformanceView` (in `SetlistPerformanceView.tsx`, behind two thin route
wrappers: `SetlistPerformanceView` and `SongPerformanceView`) loads nothing
itself: all its reads and writes go through
`useSetlistPerformanceData(target)` (`src/hooks/`), which returns
the setlist, the referenced songs (`songsById`), every referenced song's sheet
music prefetched at load (`sheetMusicBySongId`), preferences, the write
actions (`selectSheetMusic`, `saveOrder`, `onSheetMusicUploaded`), `source`,
`unavailableSheetMusicIds` and `capabilities`. Behind it, a
`PerformanceDataSource` (`performanceDataSource.ts`) opens a session per
setlist. A session emits full-row replacements after load (refreshes,
successful writes) and keeps reference identity for the parts that did not
change; the view never reseeds its items in reorder mode, and a replacement
keeps the current item by identity (`indexAfterItemsChange`,
`src/utils/performItems.ts`). Don't add service calls to the view; add them to
the source. The hook takes a `PerformanceTarget` (`performanceTarget.ts`): a
setlist, or one song (`songPerformanceDataSource`, online only, a synthetic
one-item setlist with id `song:<songId>`; no reorder, notes or sync). The view
derives `isSong` once and hides the setlist chrome for it (sidebar and `L`,
"Up next", counter, progress bar, Prev/Next, reorder, notes, `SyncControls`,
the offline toolbar and snapshot badge); exit, Escape and load errors go to
`/songs`, and a missing song renders "Song not found"
([docs/specs/song-performance.md](docs/specs/song-performance.md) §2). See §8 of
[docs/specs/offline-performance-phase2-3.md](docs/specs/offline-performance-phase2-3.md).

- **Source selection** (§8.2) lives in `PerformanceDataController`
  (`performanceDataController.ts`, plain TS, unit-tested); the hook wraps it.
  A snapshot for this user → the snapshot source, **even online**; none and
  online → network; none and offline → `unavailableOffline` ("Not available
  offline" + Back, no toast, no bounce).
- **`snapshotPerformanceDataSource`** renders from `getSnapshot`. Online it
  runs `flushLocalPreferences` then `refreshSnapshotRows` in the background
  (again when the connection returns): rows only, never a PDF; new PDFs show as
  "Not downloaded". Writes go to the server first, then patch the snapshot
  (`patchSnapshotSetlist` / `patchSnapshotPreference`); offline, or when the
  server write fails, a PDF choice is `recordLocalPreference`d (no session or
  network needed, never toasts). PDFs: `getFile` → blob URL, only the current
  one (the hook releases the previous before resolving the next), never
  prefetched.
- **Missing files** (§9.3): only a blob that is absent or reads empty counts;
  online it is recorded in `missingFiles` and its `file:` key deleted so Retry
  refetches it, offline it is only unavailable for the session. A pdf.js
  error on a readable blob is a view error with "Try again" (fresh blob URL,
  viewer remounted) and never touches the store.
- **Capabilities** (`performanceCapabilities`, §8.3): offline → no reorder,
  upload, notes or sync; guests → no reorder/upload/notes, online too. `usePerformanceSync({ enabled: canSync })` makes no
  queries and opens no Realtime channel when disabled; `SyncControls` shows
  "Sync sessions need a connection". The **R** shortcut toggles reorder only
  when allowed.
- **Position** (A2): `readPerformPosition` / `writePerformPosition`
  (`src/lib/performPosition.ts`) persist `{ currentIndex, contentView,
  selectedSheetMusicId }` per user and setlist in `localStorage`, 12 h expiry,
  restored on mount for every source; `wipeAll()` clears them.
  `?song=<songId>` (the per-song "Start performance here" button in the
  setlist detail, online and offline) wins over it: the view opens on that
  song, then drops the param with a `replace`; a song no longer in the
  setlist falls back to the saved position.
- **Exit** (X, Escape): back one history entry when an in-app page opened
  performance mode (`location.key !== "default"` at mount), else the
  setlist's detail (`/setlists/:id`) or `/songs`. Load errors still bounce
  to `/setlists` / `/songs`.
- **Content view:** the toolbar order is Lyrics · Chords · Sheet (the `T`
  shortcut and mobile toggle cycle the same way). Without a saved position the
  view opens on the user's last pick (`readPreferredContentView`,
  device-wide `bandmate_perform_content_view`, default Lyrics; not cleared by
  `wipeAll()`: it names no setlist).

### Setlist builder (Phase 1)

The editor's library panel is `SongPicker` (`src/components/setlist-builder/`,
spec [docs/specs/setlist-builder.md](docs/specs/setlist-builder.md) §3).
`SetlistEditor` loads the band's setlists (drafts included) and shows next to
the songs and computes `computeSongSignals` (`src/utils/songSignals.ts`, pure):
"played" = a **completed** show linked to a setlist containing the song;
"in a setlist" counts non-draft setlists. If either read fails the picker gets
`signals: null` and renders without the signal line, the Played chip or the
history sorts; no toast. Filters and sort (`songFilters.ts`: `filterByPicker`,
`sortForPicker`, `pickerFacets`) are one JSON object per device,
`bandmate_setlist_picker` (`usePickerState`, parsed field by field). Layout
follows width (`lg`), affordances follow input: `useInputCapabilities()`
(`(hover: hover) and (pointer: fine)`, then the last `pointerdown` type; never
the user agent). Wide + pointer: `+`, checkbox + Shift range, `/`, `↑`/`↓`,
`Enter`, drag a row into the setlist (`pickerDnd.ts`: prefixed draggable ids,
`pointerWithin` for those drags, `closestCenter` for reorders). Touch: tap a
row to select, "Add N". Narrow: the picker opens as `PickerSheet` (fixed,
z-index 1045, below reactstrap modals) and Save moves to a sticky footer.
Inserts go through `insertSongs` (`src/utils/setlistInsert.ts`).

**Reordering (PR 1.2)** — the editor, the detail view's reorder mode and
performance mode's reorder all use `useSortableSensors()` (Mouse after 8 px,
Touch as a 250 ms long-press with 5 px tolerance, Keyboard); don't go back to
a bare `PointerSensor`. Drag listeners stay on the handle, which sets
`touch-action: none` and no callout, so scrolling a row never drags. Every
sortable row also has `SetlistRowMenu` (⋮: Move up / down / to top / to
bottom via `moveItem`, `src/utils/setlistMove.ts`; Remove only in the
editor): portaled to `body`, fixed position, and its key events never reach
performance mode's window shortcuts. In performance mode the sortable rows
render `as="div"` (they hold a button). The editor's `Delete` removes the
focused row, never while typing in its notes. Picker rows take only the mouse
sensor's `onMouseDown`: the keyboard sensor's `onKeyDown` would turn Enter on
"+" into a drag.

### Real-time Features

**Performance Sync** (`usePerformanceSync` hook): Enables synchronized setlist navigation during performances.
- One host controls the current song position
- Viewers automatically follow the host
- Uses Supabase Realtime subscriptions on `performance_sessions` table
- One active session per band at a time

**Local backing tracks** (`useLocalBackingTracks` hook): audio files stay on the
device; only a song → file mapping is kept in localStorage. Nothing is uploaded.
Playback is `BackingTrackEngine` (`src/lib/backingTrackEngine.ts`, plain TS,
unit-tested) behind `BackingTrackPlayer`: the element goes through a Web Audio
graph for the L/R volumes. Two rules keep it reliable on the iPad:
- **Restart = fresh element.** A stop, a seek while paused or the end of the
  track makes the next play use a new `<audio>` + source node (the old one
  replays buffered samples from the previous position). Don't go back to
  muting for a fixed time. The new element is created when the old one
  stops (stop, end of track, stall), not inside `play()`: on iOS 17 an
  element created and started in the same tap could stay silent.
- **Never pretend to play.** A watchdog checks 1.5 s after each play that the
  time moved and the `AudioContext` is `running`; otherwise it pauses, warns
  (toast + header) and the next tap rebuilds the context and element. iOS
  only unlocks audio inside a user gesture, so there is no automatic retry.
- Each play, watchdog verdict, context change and stall is logged as
  `[backing-track] …` (`console.info`): read it in Safari's Web Inspector
  with the iPad connected to a Mac.

### Edge Functions (`supabase/functions/`)

Deno functions deployed with the Supabase CLI (`supabase functions deploy <name>`).
They run with the service role key, so they bypass RLS — validate inputs carefully.

- `calendar-feed` — public iCal feed of a band's shows and rehearsals (token-based, via
  `calendar_subscriptions`). Deploy with `--no-verify-jwt`: calendar apps send no auth
  header. It re-checks on every request that the subscriber is still in `band_members`
  and serves the last 365 days onward. The iCal builder lives in
  `supabase/functions/_shared/ics.ts`, dependency-free, shared with the app's
  single-event `.ics` downloads (`src/lib/calendarExport.ts`) and tested from
  `src/lib/__tests__/ics.test.ts`. Times are floating (the app stores no zone) plus
  `X-WR-TIMEZONE` from the subscription's `timezone`. A show with a
  `soundcheck_time` contributes two events (`showToIcsEvents`): the show and a
  `Soundcheck: <show>` event (`show-<id>-soundcheck@bandmate`) that ends at
  doors, else at show time, else after an hour; it follows `include_shows`, has
  no toggle of its own, and the `.ics` download of a show carries both.
- `send-push-notifications` — sends the Web Push notifications of one
  `notification_events` row (band push notifications, Phase 1; client side
  under "Push notifications"). Called only by the `dispatch_notification_event` trigger
  through `pg_net`, with URL + shared secret from Vault
  (`push_function_url`, `push_function_secret`); deploy with
  `--no-verify-jwt` (also in `supabase/config.toml`): it answers 401 without
  the matching `x-push-secret`, takes only `{ eventId }` and claims the event
  (`processed_at`) so a replay sends nothing. Triggers on `shows`,
  `rehearsals` (INSERT, not past / finished) and `setlists` (non-draft
  INSERT, draft → published) enqueue through `enqueue_notification_event()`,
  whose actor is `auth.uid()` (never the row's `user_id`; none → no event),
  and never make the write fail. Phase 2 (moved / cancelled,
  `20260928120000_push_notifications_changes.sql`): UPDATE triggers on
  `shows` / `rehearsals` (date, time, place, status → cancelled) go through
  `enqueue_change_event()`, which keeps **one pending row per entity** with
  `send_after` 2 min ahead and re-decides it from its `payload.before` on
  every edit (moved back → row deleted, cancel replaces moved, last editor is
  the actor). Rows with `send_after` are posted by the `pg_cron` job
  `dispatch-notification-events` (`dispatch_due_notification_events()`,
  every minute), which also re-posts any row dispatched > 10 min ago and
  never claimed (`dispatch_attempts` < 3, within a day); the function refuses
  a row still in its window (`{ deferred: true }`). Created events keep
  `send_after` null and go out at once. Tags are per entity (`show:<id>`), so
  a change replaces the creation in the tray. Texts (en/es, by the subscription's
  `locale`) are `_shared/pushMessages.ts`, recipients
  `_shared/pushRecipients.ts`, both dependency-free and tested from
  `src/lib/__tests__/`. Web Push via `jsr:@negrel/webpush@0.5.0`. Secrets:
  `VAPID_KEYS`, `VAPID_SUBJECT`, `PUSH_SECRET`. See
  [docs/setup/push-notifications.md](docs/setup/push-notifications.md) and
  [docs/specs/band-push-notifications.md](docs/specs/band-push-notifications.md).
  Needs `pg_cron` for the moved / cancelled events.
- `send-invitation-email` — sends invitation emails via Resend. Needs `RESEND_API_KEY` and `APP_URL`. See [docs/setup/email-sending.md](docs/setup/email-sending.md).

### Landing Page & SEO

The marketing landing at `/` is prerendered at build time so crawlers and
link-preview bots get real markup instead of an empty `<div id="root">`. The
authenticated app stays a pure SPA.

- `src/components/LandingPage.tsx` — the landing. Must stay SSR-safe: no
  `window`, `localStorage`, `useBandContext` or Supabase.
- `src/entry-server.tsx` — renders it with `renderToString` at build time.
- `bandmateSeo()` in `vite.config.ts` — injects the result into `index.html`
  and emits `robots.txt` + `sitemap.xml`.
- `src/lib/siteConfig.ts` — canonical origin, OG image and the list of
  indexable routes. Change the host here *and* in `vercel.json` together.

Full detail in [docs/guides/landing-seo.md](docs/guides/landing-seo.md).

### Internationalization (i18n)

Uses `react-i18next` with browser language detection:
- Locale files: `src/i18n/locales/{en,es}.json`
- Access translations via `useTranslation()` hook: `const { t } = useTranslation()`
- Language stored in localStorage

## Styling Conventions

Reference `src/theme.ts` for the design system. Key patterns:
- Dark mode is primary (`data-bs-theme="dark"` on document)
- Styled Components with transient props (`$mode`, `$active`) to avoid DOM warnings
- Brand color: `#8B5CF6` (purple)
- Use `theme.space[n]`, `theme.radius.base`, `theme.colors.dark.*` for consistency
- Icons: Bootstrap Icons (`bi-*` classes)
- Print styles: Components hide navbar and use `@media print` for print views

### User Feedback & Dialogs

**Do NOT use the browser's native `alert()`, `confirm()`, or `prompt()`.** They
break the dark theme, can't be styled, and feel out of place in the app. The
codebase has none left — keep it that way. Reuse the existing building blocks
instead of writing new ones:

- **Confirmations** (destructive actions, irreversible changes): use
  `ConfirmModal` (`src/components/ConfirmModal.tsx`). It portals to `body`, so
  it works inside other modals; supports `tone="danger" | "primary"` and a
  `busy` state for async confirms.
- **Transient success / error / warning messages**: use the toast system —
  `const toast = useToast()` then `toast.success(msg)`, `toast.error(msg)`, etc.
  (`src/context/useToast.ts`).
- **Persistent, contextual messages inside a form or modal** (e.g. a validation
  error that must stay visible): render them inline, like the `FeedbackBanner`
  in `InviteMemberModal.tsx`.
- Always localize user-facing copy through `t()` (add keys to both `en.json`
  and `es.json`).

## Database Schema Notes

All tables use Supabase RLS policies unless noted. Key tables:

| Table | Description |
|-------|-------------|
| `bands` | Band info, `owner_id` references creator, `avatar_url` |
| `band_members` | Join table with `role` enum (owner/admin/member/guest) - **RLS disabled**, enforced at app level |
| `band_invitations` | Token-based invites with expiration |
| `songs` | Songs with `band_id` FK, lyrics/chords stored as text, metadata, timing data, transposition, popularity |
| `song_sheet_music` | PDF sheet music attached to songs (files in Storage); `position` is the band's default order |
| `user_sheet_music_preferences` | Which PDF each user opens first per song, PK `(user_id, song_id)`; RLS restricts rows to `auth.uid()` |
| `setlists` | Setlists with JSONB `songs` array of items: songs `{type:'song', song_id, position, notes?}` and special items `{type:'break'|'section'|'note', id, label, position, duration?}`; `id` is a client-generated stable key assigned on read (`normalizeSetlistItem`) and used for React keys / drag-and-drop. Draft flag |
| `shows` | Shows/gigs with venue, date, soundcheck, setlist reference |
| `rehearsals` | Rehearsals with date/location |
| `requests`, `request_comments`, `request_votes` | Band proposals (new song, setlist proposal, etc.) |
| `calendar_subscriptions` | One per (band, user): feed `token`, `include_shows`, `include_rehearsals`, `timezone` (IANA, from the browser) |
| `performance_sessions` | Real-time sync sessions with `current_song_index` |
| `push_subscriptions` | Web Push subscription per browser (`endpoint` unique, keys, `locale`); RLS own rows, no INSERT policy: created by `register_push_subscription()`, which hands the endpoint to the caller |
| `band_notification_mutes` | `(user_id, band_id)`: that user gets no pushes for that band; no row = on |
| `notification_events` | Push outbox written by triggers, read by `send-push-notifications`; RLS on with no policies (clients can't read or write). `send_after` (null = now; changes wait 2 min), `dispatched_at` / `dispatch_attempts` (cron retry), `entity_kind` (generated from `type`) |

> The full schema is versioned: `supabase/migrations/20260101000000_baseline.sql`
> is a dump of production (public schema, plus the `sheet-music` bucket, its
> Storage policies and the Realtime publication) taken before the CLI
> migrations, and marked applied in production. `supabase db reset` rebuilds a
> local database from `supabase/migrations/` alone. It reproduces production
> as it was, legacy policies included — read it before assuming which
> policies exist.

### Role Permissions

| Action | Owner | Admin | Member | Guest |
|--------|-------|-------|--------|-------|
| View band/songs/setlists | ✅ | ✅ | ✅ | ✅ |
| Create/edit songs | ✅ | ✅ | ✅ | ❌ |
| Create/edit setlists | ✅ | ✅ | ✅ | ❌ |
| Delete songs / setlists (any) | ✅ | ✅ | ✅ | ❌ |
| Create/edit/delete shows and rehearsals (any) | ✅ | ✅ | ✅ | ❌ |
| Band settings | ✅ | ✅ | ❌ | ❌ |
| Manage members | ✅ | ❌ | ❌ | ❌ |

"Any" means regardless of who created the row: `user_id` is attribution, not a
permission input, and the RLS UPDATE/DELETE policies on `songs`, `setlists`,
`shows` and `rehearsals` check the role only
(`supabase/migrations/20260927120000_align_content_rls_with_roles.sql`). Views
gate write actions with `canEditContent` / `canManageEvents` on
`selectedBand.user_role` (never a bare `!== "guest"`); the list components take
a required `canEdit`. Services throw `PermissionError`
(`src/services/permissionError.ts`) on a refused write, including a delete that
RLS filtered to zero rows, and views toast `common.noPermission` for it
(`isPermissionDenied`). See
[docs/specs/content-permissions.md](docs/specs/content-permissions.md).

Because `band_members` has no RLS, every permission check in the UI/services
matters — don't drop a role check assuming the database will catch it.

## Environment Variables

Required in `.env` (see `.env.example`):
```
VITE_SUPABASE_URL=<project_url>
VITE_SUPABASE_ANON_KEY=<anon_key>
```

Optional:
```
VITE_SPOTIFY_CLIENT_ID=<spotify_client_id>          # metadata enrichment
VITE_SPOTIFY_CLIENT_SECRET=<spotify_client_secret>  # see warning below
VITE_GROQ_API_KEY=<groq_api_key>                    # AI setlist generation (https://console.groq.com)
VITE_VAPID_PUBLIC_KEY=<public key>                  # Web Push application server key from `npm run vapid-keys` (public by design)
VITE_PUSH_NOTIFICATIONS=true                        # feature flag: Notifications settings (not a secret; see "Push notifications")
```

> ⚠️ **Every `VITE_*` variable is inlined into the public client bundle.**
> `VITE_SPOTIFY_CLIENT_SECRET` and `VITE_GROQ_API_KEY` are therefore exposed to
> anyone who loads the app. This is known technical debt; the fix is to move
> those calls behind an Edge Function. **Do not add new secrets as `VITE_*`
> variables** — server-side secrets belong in Edge Function env
> (`supabase secrets set`).

## Database Migrations

- **`supabase/migrations/`** — the source of truth, applied with
  `supabase db push`. It starts with `20260101000000_baseline.sql` (see
  "Database Schema Notes"). **All new migrations go here**, named
  `<YYYYMMDDHHMMSS>_description.sql`, dated after the latest one.
- **`migrations/`** — legacy files that built the schema by hand in the
  Supabase SQL Editor. The baseline replaces them: history only, never apply
  them, don't add new files ([migrations/README.md](migrations/README.md)).

Migrations must be idempotent where practical (`IF NOT EXISTS`, `DO $$ ... EXCEPTION WHEN duplicate_object`),
following the style of the existing files: they run on top of the baseline in
`supabase db reset`. `supabase/config.toml` configures the local stack
(`supabase start`, Docker); check a migration there with `supabase db reset`
before pushing it.

## Testing & Definition of Done

Unit tests use Vitest (`npm test`, config in `vitest.config.ts`, node
environment with `fake-indexeddb` and an in-memory `localStorage` from
`src/test/setup.ts`). DOM tests opt in per file with
`// @vitest-environment jsdom` and use Testing Library (`render`,
`renderHook`, `user-event`); `src/test/renderApp.tsx` renders under the app's
providers with a hand-made `BandContext` value (`bandContext()`), and
`setContext()` re-renders with another value (e.g. `isOnline` flips) keeping
the router's location. Tests live in `__tests__/` next to the code and are
type-checked by `npm run build`. Mock Supabase rather than calling it
(`setup.ts` mocks `src/lib/supabaseClient` for every test; mock the service
functions a test needs; DOM tests mock at the service-module boundary and stub
`react-pdf` when they import the routes). Presentational parts also have
`.test.tsx` render tests with `renderToStaticMarkup` and a test i18next
instance (`src/test/i18n.ts`); keep them free of portals and service calls so
they can be rendered this way. `setup.ts` also installs a Web Locks
fake on `navigator.locks` (Node 22 has none), so the cross-tab lock tests run
the same on every Node version. Before considering a change done:

1. `npm run lint` passes with no new errors.
2. `npm run build` passes (this also type-checks and runs the SSR pass).
3. `npm test` passes; changes to the offline store, `offlineSetlistService` or
   the auth controller come with tests.
4. Any new user-facing string exists in **both** `en.json` and `es.json`.
5. The flow was exercised manually in the dev server (`http://localhost:5173`)
   with no new console errors — or, if that wasn't possible, say so explicitly.
6. If the change touches RLS or a migration, note which policies were checked.
7. Documentation is up to date (see below).

## Writing Specs

Specs in `docs/specs/` break the work into **phases**, and each phase into
**PRs**. They are not the same thing:

- A **phase** is an increment the owner can validate on its own. It states
  its goal, the acceptance criteria it closes and the manual checks that
  validate it. Phases are numbered 1, 2, …, and a later phase can be
  postponed or dropped without breaking an earlier one.
- A **PR** is a review and merge unit inside a phase, numbered
  `PR <phase>.<n>` (PR 1.1, PR 2.3). A PR may change nothing the user sees
  (e.g. a data layer); the PR that completes a phase must leave it
  validatable.
- Every spec has at least one phase, even when it is one PR ("One phase,
  one PR").
- The breakdown is the section **"Phases and PRs"**: one `### Phase N —
  <name>` per phase with **Goal**, **Closes** (ACs) and **Validate
  (manual)**, then its PRs with their scope. Sections that belong to one
  phase say so in the heading ("(Phase 2)"), not a PR number.
- The spec's header and its line in "External Documentation" state both
  counts ("Three phases, four PRs"); the status line tracks phases.

## Before Opening a Pull Request

Review `README.md` (and this file) against the change and update them in the
same PR when the change affects anything they describe:

- a user-visible feature added, removed or renamed → README **Features**
- a new/changed route, service, table, Edge Function or hook → the relevant
  section of this file
- a new or changed env variable → README setup, `.env.example` and this file
- a new npm script or build step → both files
- a new doc in `docs/` → README **Documentation** list

If nothing needed updating, say so in the PR description ("Docs: no changes
needed") so reviewers know it was checked, not skipped.

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@supabase/supabase-js` | Database, auth, real-time, storage |
| `@dnd-kit/*` | Drag-and-drop for setlist editor |
| `react-i18next` | Internationalization |
| `react-pdf` | Sheet music PDF viewer |
| `idb-keyval` | IndexedDB key-value store behind `src/lib/offlineStore.ts` (offline copies) |
| `vitest`, `fake-indexeddb` | Unit tests (dev only) |
| `jsdom`, `@testing-library/react` (+ `dom`, `user-event`) | DOM tests, per-file jsdom environment (dev only) |
| `workbox-window` | Service worker registration and update prompt (`PwaReloadPrompt`) |
| `@fontsource/space-grotesk` | Self-hosted brand font, precached for offline |
| `pdfjs-dist` | Pinned to the **exact** version `react-pdf` depends on; its worker is bundled from the app origin (`src/lib/pdfWorker.ts`) and precached so the viewer starts offline. Bump both together |
| `papaparse` | CSV import for songs |
| `styled-components` | CSS-in-JS styling |
| `reactstrap` | Bootstrap React components |

## Common Development Tasks

### Adding a new translation
1. Add key to both `src/i18n/locales/en.json` and `src/i18n/locales/es.json`
2. Use via `t('key.path')` in components

### Adding a new service
1. Create `src/services/newService.ts`
2. Import supabase client from `../lib/supabaseClient`
3. Add TypeScript interfaces for data types
4. Export async functions for CRUD operations

### Adding a new route
1. Add route in `src/AppMain.tsx` within the `<Routes>` block (wrap it in
   `OfflineAware` with `NeedsConnection` unless it works offline)
2. Create component in `src/components/`
3. Add a navigation link if needed: one entry in `NAV_LINKS` (`src/components/navLinks.ts`)
4. If the route should be indexable, add it to `src/lib/siteConfig.ts`
5. Add it to the route table above

### Adding a migration
1. Create `supabase/migrations/<timestamp>_description.sql`
2. Check it locally with `supabase db reset`, then apply with `supabase db push`
3. Update the schema table above if you add a table

## External Documentation

Index: [docs/README.md](docs/README.md).

- [docs/design/style-guide.md](docs/design/style-guide.md) - Comprehensive design system
- [docs/guides/landing-seo.md](docs/guides/landing-seo.md) - Landing prerender, meta tags, robots/sitemap
- [docs/guides/song-metadata.md](docs/guides/song-metadata.md) - Song metadata lookup + Spotify setup
- [docs/guides/band-members.md](docs/guides/band-members.md) - Roles, why `band_members` has no RLS, invitation flow
- [docs/setup/email-sending.md](docs/setup/email-sending.md) - Invitation emails (Edge Function + Resend)
- [docs/setup/google-oauth.md](docs/setup/google-oauth.md) - Google OAuth configuration
- [docs/intents/offline-performance.md](docs/intents/offline-performance.md) - Intent (in progress, Phases 1–2 shipped, Phase 3 not started): offline performance mode
- [docs/specs/offline-performance-phase2-3.md](docs/specs/offline-performance-phase2-3.md) - Spec (in progress, Phase 2 shipped (PRs 2.0–2.6), Phase 3 pending): offline performance Phases 2–3 (PR breakdown in §12)
- [docs/specs/content-permissions.md](docs/specs/content-permissions.md) - Spec (implemented): content permissions — RLS, services and UI aligned with the role matrix
- [docs/specs/song-country-language.md](docs/specs/song-country-language.md) - Spec (draft): song country/language as ISO codes, localised dropdowns (1 phase, 1 PR)
- [docs/specs/themed-setlists.md](docs/specs/themed-setlists.md) - Spec (draft): themed AI setlist generation (1 phase, 1 PR)
- [docs/specs/song-performance.md](docs/specs/song-performance.md) - Spec (implemented, manual checklist pending): perform a single song from the library (1 phase, 2 PRs)
- [docs/specs/setlist-text-export.md](docs/specs/setlist-text-export.md) - Spec (implemented): setlist text export — pure formatter, three layouts, preview, copy/share (2 PRs)
- [docs/specs/setlist-actions-layout.md](docs/specs/setlist-actions-layout.md) - Spec (implemented): setlist actions layout — detail header tiers (Perform · Edit · ⋯), sticky reorder toolbar, offline row, list cards without hover-reveal (2 PRs)
- [docs/specs/setlist-builder.md](docs/specs/setlist-builder.md) - Spec (in progress, Phase 1 implemented, validation pending): setlist builder — song picker with play history, filters and multi-select, touch reordering, target duration, templates, copy, candidates (3 phases, 4 PRs, no AI; §11 documents the unscheduled AI follow-up)
- [docs/specs/setlist-medleys.md](docs/specs/setlist-medleys.md) - Spec (draft): medleys — consecutive songs grouped into one named entry, rendering-only (1 phase, 1 PR; fragments are v2)
- [docs/specs/app-header.md](docs/specs/app-header.md) - Spec (implemented, manual validation pending): lighter app header — About out of the nav (footer + user menu), one link list for desktop and offcanvas, desktop layout from `lg`, compact user button (1 phase, 1 PR)
- [docs/specs/my-upcoming-events.md](docs/specs/my-upcoming-events.md) - Spec (implemented, manual validation (AC6–AC9, AC12 on device) pending): my upcoming events — shows and rehearsals of every band on the dashboard, one tap selects the band and opens the event or its setlist (1 phase, 4 PRs)
- [docs/setup/push-notifications.md](docs/setup/push-notifications.md) - Push notifications: VAPID keys, secrets, Vault, deploy, end-to-end check
- [docs/specs/band-push-notifications.md](docs/specs/band-push-notifications.md) - Spec (in progress, Phase 1 validated, Phase 2 implemented, device validation pending): band push notifications — Web Push (VAPID) from DB triggers via an outbox + Edge Function when another member adds a show, rehearsal or setlist, or moves / cancels a show or rehearsal (coalesced 2 min, `pg_cron`) (2 phases, 3 PRs)
- [migrations/README.md](migrations/README.md) - Database migration guide
