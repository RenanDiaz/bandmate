# Spec: Offline performance mode — Phases 2 and 3

> **Status:** draft · **Created:** 2026-09-24 · **Owner:** Renán Díaz
> **Intent:** [docs/intents/offline-performance.md](../intents/offline-performance.md)
> **Scope:** Phase 2 (snapshot + performance mode offline) and Phase 3 (update
> check and management). Phase 1 (local pdf.js worker, offline-safe auth,
> `networkTimeoutSeconds`) is assumed merged; §1 says exactly what that must
> mean. Phase 4 (backing tracks) is out.

This is a design, not code. Type declarations and function signatures are
given because they are the contract between PRs; no bodies are written here.

---

## 0. Where the code contradicts the intent

Findings from reading the code on 2026-09-24. Each one changes the plan below;
the intent should be amended where noted.

| # | Intent says | Code says | Consequence |
|---|-------------|-----------|-------------|
| C1 | Fingerprint compares "the referenced songs" (§2b). | `songs` has **no `updated_at`** column exposed (`Song` in `songsService.ts` has only `created_at`; `updateSong` writes no timestamp). The base schema is unversioned, so this must be verified on the live DB, but nothing in the repo adds it. | Song edits (lyrics, chords, key, timing) are undetectable by timestamp. Phase 3 starts with a migration adding `songs.updated_at` + the existing `update_updated_at_column()` trigger (§6.2, PR 3.0). |
| C2 | Offline, "resolve the user from the locally stored session (`getSession()`)… an expired token offline still allows opening snapshots" (§3). | `getSession()` in auth-js 2.70 refreshes when `expires_at` is within 90 s; a refresh that fails on a network error returns `{ session: null }` (`GoTrueClient.__loadSession`). Supabase access tokens expire after 1 h by default. | After more than an hour in airplane mode `getSession()` alone yields no user. The app must persist a `lastKnownUserId` on every auth event and use it offline (§7.1). If Phase 1 did not ship this, it is a Phase 2 prerequisite. |
| C3 | Phase 1 makes auth offline-safe and the shell survives (§3). | `BandContext` calls `getMyBands()` with **no error path**: on rejection `isResolvingBand` never becomes `false`, and `App.tsx:324` renders a spinner while `user && isResolvingBand`. Even with a user, offline the app is a spinner forever. `selectedBand.user_role` also drives `canEditSongs`. | The snapshot must store the **full `Band` row** (including `user_role`), not just name/avatar, and `BandContext` needs an offline branch that resolves `bands`/`selectedBand` locally (§7.2). |
| C4 | "What already works: the app shell is precached." Risk list does not mention SW updates. | `VitePWA({ registerType: 'autoUpdate' })` generates a worker with `skipWaiting` + `clientsClaim`, and `registerSW` in auto mode calls `window.location.reload()` on `activated` with `isUpdate` (`vite-plugin-pwa/dist/client/build/register.js:41`). `PwaReloadPrompt`'s `onNeedRefresh` is never invoked in this mode, so the banner is dead code. | A deploy during a show plus a moment of signal can reload the page mid-song. Switch to `registerType: 'prompt'` so the existing banner does its job (§8.3, PR 2.0). |
| C5 | §4: offline PDF selection "is saved to the server next time we are online, best effort". §Out of scope: "any write queue". | `handleSelectSheetMusic` (`SetlistPerformanceView.tsx:619`) writes to the server immediately and **toasts an error on failure**. | Offline, every PDF switch would show an error toast. This spec keeps one tiny, explicitly bounded write: preference overrides live in the snapshot and are flushed once, best effort, next time performance mode opens online (§5.6). Nothing else is queued. Amend the intent's out-of-scope line to say so. |
| C6 | Phase 2 "Done when #2": open the app offline, "go to that setlist and perform it". §5 puts the "Offline setlists" list in Phase 3. | `Home`, `SetlistsView` and `SetlistDetailView` all fetch on mount with no offline path; `SetlistDetailView` and the performance view both `navigate("/setlists")` on load failure. Offline, there is no way to *reach* a snapshot. | A minimal offline setlist list moves into **Phase 2** (§7.3). Phase 3 keeps the management view (sizes, refresh, remove). |
| C7 | Show total size before downloading (§1). | `song_sheet_music` has **no size column**; `SheetMusic` exposes none. | Size comes from `storage.from('sheet-music').list('{bandId}/{songId}')` at plan time, one request per song, in parallel (§4.2). No schema change. |
| C8 | Finding #6: the Workbox cache is keyed by URL and ignores auth. | The `supabase-api` NetworkFirst rule matches **every** `*.supabase.co` request, including signed-URL PDF GETs (`statuses: [0, 200]`). Downloading a PDF through the SW copies up to 50 MB into that cache too. | Narrow the rule to `/rest/v1/` and `/auth/v1/` (or exclude `/storage/v1/`) so PDF bytes are stored exactly once, in the snapshot (§8.4, PR 2.0). |
| C9 | §2: performance mode reads through one entry point. | `usePerformanceSync` calls `getUserBandRole` and `getActiveSessionWithHost` on mount and opens a Realtime channel on join; `subscribeToSession` has no offline guard. | The hook gets an `enabled` flag; offline it does nothing and reports `unavailable` (§5.5). |
| C10 | "No redirect to login" (Done when #2). | No route is guarded. With `user === null` the performance view mounts, `getSetlist` throws "User not authenticated", and the view **bounces to `/setlists`** with an error toast. | The failure mode is a bounce, not a login redirect. Acceptance criteria are phrased against the bounce (§9). |

Confirmed consistent with the intent: storage paths are `{bandId}/{songId}/{sheetMusicId}.pdf` and `song_sheet_music.file_url` stores the **path**, not a URL (`SheetMusicUpload.tsx:706`); the bucket is private with a band-membership SELECT policy on `storage.objects`; there is no "replace PDF in place" flow (only create and delete), so a changed file always has a new row id and path; guests can read everything the snapshot needs; the legacy `songs.sheet_music_url` column is read by no view and is ignored here.

---

## 1. What Phase 1 must have delivered

This spec assumes, and PR 2.0 verifies before anything else lands:

1. pdf.js worker served from the app origin and precached (no `unpkg`).
2. `supabase-api` runtime cache has `networkTimeoutSeconds` (3–4 s).
3. `BandContext` obtains the user from `getSession()` first and only falls back
   to `getUser()` when online.
4. **Not** covered by Phase 1 and handled here: `lastKnownUserId` (C2), band
   resolution offline (C3), SW update mode (C4), storage-rule narrowing (C8).

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
  /** Phase 3. "unknown" until the first successful check after savedAt. */
  freshness: "unknown" | "fresh" | "outdated" | "deleted";
  lastCheckedAt: string | null;
  /** Phase 3: what the last check found, for the "what changed" summary. */
  lastDiff: OfflineDiff | null;
  /** Phase 3: last time every file was read back successfully (§6.5). */
  verifiedAt: string | null;
}

export interface OfflineMissingFile {
  storagePath: string;
  sheetMusicId: string;
  songId: string;
  reason: "quota" | "network" | "not-found" | "forbidden" | "unknown";
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
  /** song_sheet_music.updated_at at download time; part of the fingerprint. */
  rowUpdatedAt: string;
}

/** Stored once per storage path, shared across snapshots. */
export interface OfflineFileRecord {
  storagePath: string;
  blob: Blob;                 // type "application/pdf"
  bytes: number;
  rowUpdatedAt: string;
  downloadedAt: string;
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
| `last-user` | `string` (auth uid) | Written by `BandContext` on `SIGNED_IN` / `TOKEN_REFRESHED` / `INITIAL_SESSION`; cleared on sign-out (C2). Lives here rather than `localStorage` so `wipeAll()` covers it. |

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

1. **Owner.** Every read filters by `userId === currentUserId`. On sign-in, if
   `last-user` exists and differs from the new uid, `wipeAll()` runs before
   anything else (a shared device changed hands without signing out, e.g. after
   a token revocation).
2. **Schema.** If `meta.schemaVersion !== OFFLINE_SCHEMA_VERSION`, or a record
   carries a different version, the whole store is wiped and re-initialized.
   There is no migration path in v1; downloading again is the migration.
3. **Files are shared.** `file:{path}` may be referenced by several snapshots.
   It is deleted only when no `snapshot-meta` (and no `download` journal)
   references it (§4.6).
4. **Meta before data.** `snapshot-meta` and `snapshot` are written in one
   `setMany` (one IDB transaction). Readers that find one without the other
   treat the snapshot as absent and schedule GC.
5. **Files before meta.** A `snapshot-meta` is only ever written after every
   file in its plan has either been stored or recorded in `missingFiles`.
6. **Sign-out.** `wipeAll()` clears the store (`clear()`), then
   `localStorage` keys `bandmate_preferred_instrument_*` are left alone (they
   are not offline data). It is awaited in `AuthButton.logout` **before**
   `supabase.auth.signOut()` resolves, and also run from the `SIGNED_OUT` auth
   event so other tabs / token revocations are covered.

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
  files whose `(storagePath, rowUpdatedAt)` already exist are `skipped-present`.
  Produce a `DownloadPlan`. No writes yet.
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
  bytesUnknown: number;             // count of files with null size
  bytesAlreadyPresent: number;
  estimate: { usage: number; quota: number } | null;  // navigator.storage.estimate(), null if unsupported
}
```

Size comes from `storage.from("sheet-music").list("{bandId}/{songId}")`, one
call per distinct song, run in parallel with a concurrency cap of 4. A song
whose listing fails still downloads; its files count under `bytesUnknown`.

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
after `cancel`, and after a Phase 3 update commit. It lists `file:*` keys and
deletes any not referenced by a `snapshot` or `download` journal of the
current user. It never touches keys of another user except through
`wipeAll()` (§3.5 #1).

---

## 5. `offlineSetlistService` public API

`src/services/offlineSetlistService.ts`. Components never import
`offlineStore` or `idb-keyval` directly (CLAUDE.md service-layer rule).

### 5.1 Reads (work offline)

```ts
/** Store meta and schema check; wipes on mismatch. Cheap; memoized per session. */
export function openOfflineStore(): Promise<OfflineStoreMeta>;

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
export function wipeAll(): Promise<void>;
```

### 5.3 Freshness (Phase 3, need network)

```ts
export type FreshnessResult =
  | { status: "fresh"; checkedAt: string }
  | { status: "outdated"; checkedAt: string; diff: OfflineDiff }
  | { status: "deleted"; checkedAt: string }
  | { status: "unknown"; checkedAt: string; reason: "offline" | "error" };

/** Checks every snapshot of the current user (or the given ids), updates each meta, returns results. */
export function checkForUpdates(setlistIds?: string[]): Promise<Record<string, FreshnessResult>>;

/** Reads back every file of a snapshot; updates verifiedAt or completeness/missingFiles. Works offline. */
export function verifySnapshot(setlistId: string): Promise<{ ok: boolean; missing: OfflineMissingFile[] }>;
```

### 5.4 Errors

`OfflineError` is a class with a `code` discriminator. Pre-condition failures
**reject**; per-file failures are **returned** in `DownloadResult`.

| `code` | Thrown by | When |
|--------|-----------|------|
| `not-authenticated` | plan, download, check | No current user id (neither session nor `last-user`). |
| `offline` | plan, download, check | `useOnlineStatus` says offline, or the first request fails with a network error. |
| `setlist-not-found` | plan | `setlists` returns no row (deleted, or RLS hides it). Same for a song that vanished between plan and download: recorded per file as `not-found`. |
| `download-in-progress` | download | Another download is running. The UI offers to cancel it. |
| `plan-stale` | download | `plan.setlistId` already has a newer journal or the plan is older than 10 minutes (signed URLs and sizes may have changed). Re-plan. |
| `storage-unavailable` | any | `indexedDB.open` fails (Safari private mode, "InvalidStateError", disk full at open). Every read API then returns empty/null and the UI hides offline features with an explanation. |
| `quota-rows` | download (returned as `failed`) | The commit transaction itself does not fit (§4.5). |
| `schema-mismatch` | never thrown | Handled by wiping (§3.5 #2); surfaced as "nothing downloaded". |
| `snapshot-owned-by-other-user` | never thrown | Filtered out by reads; wiped at sign-in (§3.5 #1). |
| `cancelled` | download (returned as `cancelled`) | `cancelDownload` or `signal.abort()`. |

Per-file `reason` values: `quota`, `network` (fetch threw or status 0/5xx),
`not-found` (404 from storage or row gone), `forbidden` (401/403: membership
changed mid-download), `unknown`.

### 5.5 Events

```ts
export type OfflineEvent =
  | { type: "snapshot-changed"; setlistId: string }   // saved, updated, removed, freshness changed
  | { type: "download-progress"; setlistId: string; progress: DownloadProgress }
  | { type: "store-wiped" };

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
  (setlists: `deleted` status; songs and sheet music: `outdated` with the id in
  `diff.removed…`). A row present on the server and absent from the snapshot
  is an addition. Deletions are never inferred from timestamps.
- An id that disappears because the user lost access (RLS now hides it) is
  indistinguishable from a deletion and is treated the same: the local copy
  is stale either way.
- Strings are compared byte-for-byte. Never parse the timestamps: PostgREST
  formats them consistently, and parsing loses sub-millisecond precision.
- Band name/avatar are **not** part of the fingerprint. They refresh on any
  update.

What each user action maps to:

| Edit | Detected via |
|------|--------------|
| Reorder items, change notes, add/remove songs, rename setlist | `setlists.updated_at` (every write in `setlistsService` sets it) |
| Lyrics, chords, key, tempo, timing data | `songs.updated_at` — **only after the migration in §6.2** |
| Add / delete a PDF | id set difference on `song_sheet_music` |
| Rename PDF, change instrument, page timings, reorder PDFs | `song_sheet_music.updated_at` (trigger exists) |
| Replace a PDF | Does not exist as a flow; it is delete + add, covered above |
| Setlist deleted | `setlists` query returns no row → `deleted` |

```ts
export interface OfflineDiff {
  setlistChanged: boolean;
  songsChanged: string[]; songsAdded: string[]; songsRemoved: string[];
  sheetMusicChanged: string[]; sheetMusicAdded: string[]; sheetMusicRemoved: string[];
  /** Files that would be downloaded by an incremental update, with sizes if known. */
  filesToDownload: Array<OfflineFileRef & { bytes: number | null }>;
  filesToDelete: OfflineFileRef[];
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

### 6.3 The check — three queries, no files

`checkForUpdates` runs, per snapshot:

1. `setlists.select("id, updated_at, songs").eq("id", setlistId).maybeSingle()`
   → `null` ⇒ `deleted`.
2. `songs.select("id, updated_at").in("id", unionOfServerAndSnapshotSongIds)`.
3. `song_sheet_music.select("id, song_id, updated_at, file_url").in("song_id", serverSongIds)`.

Snapshots of the same band are checked in one batch (queries 2 and 3 use the
union of ids across them) so a device with five setlists still issues about
three requests per band. Each result updates `snapshot-meta.freshness`,
`lastCheckedAt`, `lastDiff` and emits `snapshot-changed`.

Triggers: app start (once, after resume + GC), `online` event with a 5 s
debounce, opening a snapshot's detail or performance mode online, and the
Refresh button in management. Never on a timer while performing, never
downloads anything, never runs offline (returns `unknown/offline`).

### 6.4 Incremental update

"Update offline copy" = `planDownload(setlistId, { incremental: true })` →
confirmation with the diff's bytes → `downloadSetlist(plan)`. The plan's
`filesToDownload` is the diff's list; `filesAlreadyPresent` is everything else
in the new snapshot; `filesToDelete` are files of the old snapshot not in the
new one. Rows are always refetched in full (cheap). Commit replaces the
snapshot in one transaction (§4.3); old files are GC'd after commit if no
other snapshot references them. The `outdated` state survives a failed update.

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
"Available offline · {date}", "Outdated", "Deleted on server", "Partial".

---

## 7. Offline entry point

### 7.1 Who is the user

`BandContext` resolves `user` in this order, stopping at the first hit:

1. `getSession()` (Phase 1).
2. Offline only: `last-user` from the store → a **minimal user object**
   `{ id }` typed as `OfflineUser`, and `authMode: "offline-cached"`. Every
   consumer that needs more than the id (`AuthButton` display name, invitation
   flows) already handles `user` loosely; the context exposes `authMode` so
   they can hide themselves.
3. Otherwise `null` → landing page.

When `authMode === "offline-cached"` and the device comes back online, the
context re-runs step 1; if that yields a different uid or null, `wipeAll()`
runs (§3.5 #1) and the app behaves as signed out.

### 7.2 Which band

`BandContext` band resolution becomes:

- Online: `getMyBands()` as today, **with a catch** that falls back to the
  offline branch on network failure (a weak connection is the common case).
- Offline branch: `listOfflineBands()` → `bands`; `selectedBand` = the one in
  `BandStorage`, else the only one, else `null`. `isResolvingBand` becomes
  `false` in every path.
- With `user` set and no local bands: `BandSelector` is **not** shown offline
  (it would try to create/list bands). An `OfflineEmptyState` renders instead:
  "You're offline and nothing is saved on this device."

### 7.3 Where the setlist is

- **`/`** offline with a user: `Home` renders `OfflineHome` instead of the
  dashboard: the snapshot list of the selected band (name, saved date,
  completeness, Perform button) plus interrupted downloads. No dashboard
  fetches are issued.
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
  /** Resolves a PDF to something SheetMusicViewer can open; blob URL offline, signed URL online. */
  resolvePdfUrl: (sm: SheetMusic) => Promise<string>;
  /** Persists the choice wherever the mode allows (server online, snapshot offline). Never toasts. */
  selectSheetMusic: (sm: SheetMusic) => void;
  source: "network" | "snapshot";
  capabilities: { canReorder: boolean; canUpload: boolean; canSync: boolean; canEditNotes: boolean };
}
```

Behind it, a `PerformanceDataSource` interface with one implementation,
`networkPerformanceDataSource`, that reproduces today's calls with two
improvements that are needed anyway:

- `getSongsByIds(ids)` (new in `songsService`) instead of `getBandSongs`;
  performance mode only ever looks up referenced songs (`getSongById`).
- `getSheetMusicForSongs(ids)` (new in `songSheetMusicService`, one `.in()`
  query, grouped and sorted by position) prefetched at load, so navigation no
  longer fetches per song. `loadSheetMusicList` becomes a pure lookup.

`resolvePdfUrl` online keeps calling `getSheetMusicUrl`. The component keeps
its `allSongs.find` sites by reading from `songsById`; the reorder, upload
and sync code paths are untouched in this PR. `capabilities` are all `true`
except `canReorder`/`canUpload`/`canEditNotes`, which follow the existing
guest rule (`selectedBand.user_role !== "guest"`).

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

1. Snapshot exists for this user → **snapshot**, even when online. (Instant,
   immune to weak signal; the intent's §2. Online, the freshness banner covers
   staleness.) Online with a snapshot also triggers `flushLocalPreferences`
   and, Phase 3, `checkForUpdates([setlistId])`.
2. No snapshot and online → **network**, with the Phase 1 timeout.
3. No snapshot and offline → `status: "error", error: "network"`, rendered
   as "Not available offline" with a Back button. No `navigate("/setlists")`
   bounce, no toast (C10).

`capabilities` offline: `canReorder`, `canUpload`, `canEditNotes`, `canSync`
all `false`. Online with a snapshot: as today (writes go to the server; the
next update check will flag the snapshot as outdated, which is correct).

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
  (`missingFiles`) is shown disabled with "Not downloaded".
- `PDFErrorBoundary` fallback text offline says the file is not on the device.

### 8.4 Service worker changes (PR 2.0)

- `registerType: 'prompt'`. `PwaReloadPrompt` already implements the prompt
  flow; it starts working. Add: the banner is **not** shown while the route
  matches `/setlists/:id/perform` (deferred until the user leaves), so a
  waiting worker never reloads a show.
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
   persists `currentIndex`, `contentView` and `selectedSheetMusicId` per
   setlist in `sessionStorage` and restores them on mount, so a relaunch
   during a show returns to the same song. (Small; PR 2.4.)
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
- **B7** Given B2, when the app is backgrounded for 10 minutes and resumed
  (or relaunched), then it returns to the same song and view.
- **B8** Given I am offline and `S2` has **no** snapshot, when I open
  `/setlists/S2/perform` by deep link, then I see "Not available offline" with
  a Back button; no toast, no bounce to `/setlists`.
- **B9** Given `S1` is downloaded with one PDF missing (`partial`), when I
  open that song's sheet music offline, then that PDF is listed as "Not
  downloaded" and the other PDF still opens.
- **B10** Given `S1` is downloaded, when I open it **online**, then it renders
  from the snapshot (`source: "snapshot"`), the "Offline copy" badge shows,
  and editing actions are available.

### Phase 2 — sign-out and privacy

- **C1** Given `S1` is downloaded, when I sign out, then `listSnapshots()` is
  empty, the IndexedDB store has no `file:` keys, and the offline home shows
  nothing after relaunching offline.
- **C2** Given user A downloaded `S1`, when user B signs in on the same device
  without A signing out (session replaced), then A's snapshots are wiped before
  B sees any list.
- **C3** Given a PDF was downloaded, then the `supabase-api` Cache Storage
  cache contains no `/storage/v1/` entries.

### Phase 3 — update check

- **D1** Given `S1` is downloaded and unchanged, when I go online and open
  its detail, then the badge reads "Available offline" and `freshness` is
  `"fresh"`.
- **D2** Given a bandmate reorders `S1`, when I go online and open the app,
  then within one check cycle `S1` is "Outdated" in the list and the detail
  and performance banners read "This setlist changed since you downloaded it".
- **D3** Given a bandmate edits the lyrics of a song in `S1` (after the
  `songs.updated_at` migration), when the check runs, then `S1` is "Outdated"
  with that song in `diff.songsChanged`.
- **D4** Given a bandmate deletes one PDF of a song in `S1`, when the check
  runs, then `S1` is "Outdated" with the id in `diff.sheetMusicRemoved`, and
  no PDF is downloaded by the check itself (no `/storage/` requests).
- **D5** Given a bandmate deletes `S1`, when the check runs, then the snapshot
  shows "Deleted on server" with only Remove offered, and it still performs
  offline until removed.
- **D6** Given I am offline, when the app starts, then no check runs and the
  freshness shown is the last known one.

### Phase 3 — incremental update

- **E1** Given D2, when I tap "Update offline copy", then the confirmation
  shows 0 bytes to download, and after it completes the snapshot is "fresh"
  and reflects the new order.
- **E2** Given a bandmate replaced a PDF (delete + add) in `S1`, when I
  update, then exactly one file downloads, the old file's key is gone after
  GC, and the other files are untouched (`downloadedAt` unchanged).
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

**Download**
- [ ] Size estimate shown before download matches the sum of PDF sizes within rounding.
- [ ] Progress survives switching to another app and back mid-download.
- [ ] Kill the app mid-download; relaunch online: resumes, does not re-download stored files.
- [ ] Fill the device storage (large video files) until a PDF does not fit: partial result, message names the PDF; free space, Retry: completes.
- [ ] `navigator.storage.persist()` answer shown in management; note the value per OS.

**Perform offline**
- [ ] Airplane mode + relaunch: perform `S1` end to end, both PDFs of a song, page turns, invert, font size.
- [ ] Sync controls disabled with explanation; no error toasts anywhere during the run.
- [ ] Rotate the device and lock/unlock the screen mid-song: same song after unlock.
- [ ] Background for 10+ minutes, resume: same song. Relaunch: same song.
- [ ] Switch PDFs offline; come online; open performance mode again; check the server preference in another device.

**Update and management (Phase 3)**
- [ ] Edit `S1` on a laptop; on the phone, come online: "Outdated" appears without opening the setlist.
- [ ] Update offline copy: only the changed file downloads (watch bytes).
- [ ] Verify after a week without opening the app: still verified (eviction check). Record the result per OS; this is the data point the intent's risk asks for.
- [ ] Sign out: management view is empty; relaunch offline: nothing listed.

**Service worker**
- [ ] Deploy a new version while performance mode is open online: no reload; leaving performance mode shows the reload banner.
- [ ] Relaunch the installed app offline after that deploy: the old version still opens and performs.

---

## 12. Task breakdown

Each PR is reviewable alone, passes lint + build, and updates docs in the
same PR (CLAUDE.md service/hook tables, README Features, `en.json` +
`es.json`). Order matters within a phase.

### Phase 2

| PR | Title | Contents | Depends on |
|----|-------|----------|------------|
| 2.0 | Shell hardening for offline | `registerType: 'prompt'` + banner deferred on perform route; narrow `supabase-api` rule; `useOnlineStatus` hook exposed via `BandContext`; `last-user` written on auth events. Verify Phase 1 items (§1). | Phase 1 |
| 2.1 | Extract performance data loading | `useSetlistPerformanceData` + `PerformanceDataSource` + `networkPerformanceDataSource`; `getSongsByIds`; `getSheetMusicForSongs`; view consumes the hook. No offline code. | — |
| 2.2 | Offline store and service core | `idb-keyval` dependency; `offlineStore.ts` key layout + schema guard + wipe; `offlineSetlistService`: reads, plan, download state machine, journal/resume, quota handling, GC, events, `wipeAll` wired to sign-out and `SIGNED_OUT`. No UI, no migration. | 2.0 |
| 2.3 | "Make available offline" action | Button + confirmation + progress modal (reuse `ConfirmModal` tone/busy; a new `OfflineDownloadModal`) in `SetlistDetailView`, `ShowDetailView` ("Get this show ready offline") and performance mode's top bar; partial/error result view; Remove from detail. Badge in `SetlistList`/detail with saved date. | 2.2 |
| 2.4 | Perform from the snapshot | `snapshotPerformanceDataSource`; source selection; blob URL lifecycle; capabilities gating; offline badge; `SyncControls` disabled state; `usePerformanceSync({ enabled })`; local preference override + flush; per-setlist position persistence; error boundary copy. | 2.1, 2.3 |
| 2.5 | Offline entry point | `BandContext` offline user/band resolution (§7.1–7.2); `OfflineHome`, `OfflineSetlistList`, `OfflineSetlistDetail`, `OfflineEmptyState`; route wiring for `/`, `/setlists`, `/setlists/:id`; resume + GC at start; generic "needs a connection" fallback for other routes. | 2.4 |
| 2.6 | Docs and i18n sweep | CLAUDE.md (service, hooks, key layout pointer, sign-out rule), README Features ("Perform a setlist offline"), `docs/OFFLINE.md` linking this spec; intent status → "in progress", C5/C6 amendments. | 2.5 |

### Phase 3

| PR | Title | Contents | Depends on |
|----|-------|----------|------------|
| 3.0 | `songs.updated_at` migration | Migration + trigger + `Song.updated_at`; note policies checked; apply to prod before 3.1 ships. | — |
| 3.1 | Fingerprint and update check | `OfflineFingerprint` computed at download; `checkForUpdates` with batching; freshness state + `lastDiff` in meta; triggers (start, online, open); `verifySnapshot`. | 2.6, 3.0 |
| 3.2 | Outdated / deleted UX | Badge states in list and detail; banners in detail and performance mode with "Update offline copy"; "Deleted on server" state. | 3.1 |
| 3.3 | Incremental update | `planDownload({ incremental })`, `filesToDelete`, refcounted GC after commit, old snapshot readable until commit. | 3.2 |
| 3.4 | Offline setlists management | Section in `BandSettings` + user-menu entry; usage/quota/persisted; per-snapshot Verify/Refresh/Remove; interrupted downloads Resume/Discard; iOS install hint. | 3.3 |
| 3.5 | Docs | CLAUDE.md/README updates; intent status → "shipped (phases 1–3)"; device checklist results recorded in `docs/OFFLINE.md`. | 3.4 |

Not in any PR above (separate intents): backing tracks persistence (Phase 4),
offline access to shows/requests/song library, any editing offline.
