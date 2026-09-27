# Spec: Perform a single song from the song library

> **Status:** draft · **Created:** 2026-09-26 · **Owner:** Renán Díaz
> **Origin:** TODO "Poder ver una canción tipo performance desde la lista de
> canciones".
> **Scope:** a Perform action on every song card that opens the existing
> performance mode for that one song. One phase, two PRs (§9). Largest of the five
> TODO specs; do the others first.

This is a design, not code. Signatures are the contract; no bodies here.

## 0. Where we are

Performance mode is `SetlistPerformanceView` at `/setlists/:setlistId/perform`
(≈ 3 000 lines). It loads nothing itself: `useSetlistPerformanceData(setlistId)`
wraps a `PerformanceDataController` that opens a `PerformanceDataSource`
(network, or the offline snapshot when the flag is on) keyed by `setlistId`.
Everything downstream assumes a setlist:

| Assumption | Where |
|------------|-------|
| The route param is `setlistId` | `useParams`, `AppMain.tsx` |
| Rows carry a `Setlist` (`id`, `band_id`, `name`, `songs`) | `PerformanceRows.setlist`; the view reads exactly those four fields |
| Sync sessions reference a setlist | `performance_sessions.setlist_id NOT NULL REFERENCES setlists` |
| Position memory is per user + setlist | `performPosition.ts` key `bandmate_perform_position_{uid}_{setlistId}` |
| Local backing tracks are per setlist | `useLocalBackingTracks(setlistId)` → `bandmate_backing_tracks_{setlistId}` |
| Exit / Escape / load error go to `/setlists` | view lines ≈ 441, 458, 899, 973 |
| Setlist chrome: sidebar, "Up next", counter, progress, prev/next, reorder, notes, Sync, Offline toolbar | view |
| The PWA reload prompt hides on the perform route | `PwaReloadPrompt.NO_RELOAD_ROUTES` |

What already helps: the view reads only four setlist fields; the data layer
is behind one interface with tests (`performanceDataController.test.ts`,
`snapshotPerformanceDataSource.test.ts`); a "song" needs the same rows a
one-item setlist has (song, its sheet music, preferences, preferred
instrument). `getSongsByIds([id])` and `getSheetMusicForSongs([id])` exist.

## 1. Decisions

1. **One view, two targets.** Performance mode gets a `PerformanceTarget`
   (`setlist` or `song`) instead of a `setlistId`. The song target renders
   the same view with a synthetic one-item setlist and the setlist-only
   chrome hidden. No second performance view: the PDF viewer, chords,
   lyrics, font size, colour inversion, timing sync and backing tracks are
   exactly what the TODO wants, and forking them is the wrong kind of cheap.
2. **Synthetic setlist, real song.** The song source builds a `Setlist` in
   memory (`id: "song:<songId>"`, `name: song.title`, one song item). Reads
   of sheet music and preferences are real; writes that make sense for a
   song (choose a PDF, upload a PDF) are real; writes that need a setlist row
   (reorder, notes) are not offered.
3. **Online only in this phase.** No snapshot lookup: offline the route
   renders "This page needs a connection" like `/songs`. Reading a song out
   of any snapshot that contains it is a follow-up once §11 of the offline
   spec has shipped; it does not change this contract.
4. **No sync for songs.** `performance_sessions.setlist_id` is a NOT NULL
   foreign key; a song has no row to point at. `canSync` is false for the
   song target and `SyncControls` is not rendered. (Making the column
   nullable to sync a single song is a real option, but it needs the
   Realtime hook and the "one session per band" rule revisited; separate
   spec if wanted.)
5. **Every role can perform a song**, like every role can perform a setlist.
   Upload stays role-gated (`canUpload`), as today.
6. **Memory keys reuse the pseudo id.** Position (`contentView`, chosen
   PDF) and local backing tracks are stored under `song:<songId>`, so a
   track attached in a setlist is not seen in song mode and vice versa. This
   is accepted for now: the backing-track mapping is device-local and
   already per setlist.

## 2. UX

- **Song card** (`SongList`, every role): an icon button `bi-play-circle`
  with tooltip/aria `songs.perform` next to the expand chevron, outside the
  `canEdit` dropdown (guests must see it). Click → `/songs/:songId/perform`.
  It stops propagation so the card does not expand.
- **Performance view, song target:**
  - Title: the song title; below it the artist (new `SongSubtitle` slot,
    setlist target shows nothing there). SEO title `"{title} - Performance
    Mode"`.
  - Hidden: sidebar toggle and sidebar, "Up next" bar, `{n} / {total}`
    counter, progress bar, bottom Prev/Next, Reorder button, notes box,
    `SyncControls`, `OfflineDownloadAction` toolbar, the snapshot badge.
  - Kept: content view switch (chords / lyrics / sheet music), PDF viewer
    with page navigation (ArrowLeft/Right still turn pages), font size, PDF
    colour inversion, fullscreen, transposition display, timing-synced
    lyrics/pages, backing track player, "Add PDF" when `canUpload`, sheet
    music picker and per-user preference.
  - Exit (X) and Escape (when not fullscreen) → `/songs`. Load error toast
    `songs.loadError` → `/songs`. Not found → "Song not found" + Back to
    songs (`songs.backToSongs`).
  - Keyboard: `r`/`R` is a no-op (no reorder), `l`/`L` is a no-op (no list).
- Offline (flag on, `isOnline` false): `NeedsConnection` with the link home,
  same as `/songs`.

## 3. Contract

### 3.1 Target

```ts
// src/hooks/performanceTarget.ts (plain TS)
export type PerformanceTarget =
  | { kind: "setlist"; setlistId: string }
  | { kind: "song"; songId: string };

/** Stable id for memory keys and for the synthetic setlist: setlistId, or "song:<songId>". */
export function performanceTargetKey(t: PerformanceTarget): string;
export function isSongTarget(t: PerformanceTarget): t is Extract<PerformanceTarget, { kind: "song" }>;
```

### 3.2 Data source

```ts
export interface PerformanceDataSource {
  readonly kind: "network" | "snapshot" | "song";
  open(target: PerformanceTarget): PerformanceSession;   // was open(setlistId)
}
```

`networkPerformanceDataSource.open` and the snapshot source's `open` accept
only `kind: "setlist"` and throw `PerformanceDataError("not-found")` for a
song target (they are never handed one by the controller; the check keeps
the contract honest).

New `src/hooks/songPerformanceDataSource.ts`, `kind: "song"`:

- `load`: `getSongsByIds([songId])` → exactly one row with the current
  band's id, else `not-found`; `getPreferredInstrument(song.band_id)`;
  `getMySheetMusicPreferences([songId])` (failure swallowed, as network);
  `getSheetMusicForSongs([songId])` (failure sets stale, as network). Emits
  rows with the synthetic setlist:

  ```ts
  const setlist: Setlist = {
    id: `song:${song.id}`, band_id: song.band_id, user_id: song.user_id,
    name: song.title, description: undefined, is_draft: false,
    songs: [{ type: "song", song_id: song.id, position: 0 }],
    youtube_playlist_url: undefined, created_at: song.created_at, updated_at: song.created_at,
  };
  ```
  The `setlist` object identity is kept across emits (same rule as the other
  sources: `items` must stay `===`).
- `refresh`: re-reads sheet music for `[songId]`, shares identity like
  `shareRows`.
- `resolvePdfUrl`, `savePreference`: identical to the network source
  (`createSheetMusicDownloadUrl`, `setMySheetMusicPreference`).
- `saveOrder`: rejects with `Error("song target has no order")`; never
  called because `canReorder` is false.
- `isSheetMusicStale`, `subscribe`, `close`: as network.

### 3.3 Controller

`PerformanceDataControllerOptions.setlistId: string` becomes
`target: PerformanceTarget`, plus `song: PerformanceDataSource`. `start()`:

- `target.kind === "song"` → open `song`; never the snapshot source, never
  `unavailableOffline` (the route is already gated by `NeedsConnection`; if
  reached offline anyway the load fails with `network`).
- `target.kind === "setlist"` → unchanged.

```ts
export interface PerformanceCapabilities { canReorder; canUpload; canSync; canEditNotes; }
export function performanceCapabilities(input: { role; isOnline; target: PerformanceTarget }): PerformanceCapabilities;
// song target: canReorder = false, canSync = false, canEditNotes = false, canUpload as today.
```

### 3.4 Hook and view

- `useSetlistPerformanceData(target: PerformanceTarget | undefined)`; the
  return type gains `target`. Every `setlistId` inside it becomes
  `performanceTargetKey(target)` (position restore/save) or `target`.
- `SetlistPerformanceView` becomes `PerformanceView` internally with a thin
  route wrapper each:

  ```ts
  // src/components/SetlistPerformanceView.tsx  (default export kept: route + tests import it)
  export default function SetlistPerformanceView() {
    const { setlistId } = useParams(); return <PerformanceView target={{ kind: "setlist", setlistId }} />;
  }
  // src/components/SongPerformanceView.tsx
  export default function SongPerformanceView() {
    const { songId } = useParams(); return <PerformanceView target={{ kind: "song", songId }} />;
  }
  ```
  `PerformanceView` (same file as today, renamed component) derives
  `isSong = isSongTarget(target)` once and gates the chrome in §2 on it;
  `exitPath = isSong ? "/songs" : "/setlists"` replaces the four hard-coded
  `/setlists` navigations; `usePerformanceSync({ enabled: capabilities.canSync })`
  stays (disabled makes no queries); `useLocalBackingTracks(performanceTargetKey(target))`.
- `PwaReloadPrompt.NO_RELOAD_ROUTES` gains `/songs/:songId/perform`.
- `AppMain.tsx`: `<Route path="/songs/:songId/perform" element={needsConnection(<SongPerformanceView />)} />`,
  declared before `/songs/print` is irrelevant (different segment count) but
  keep the songs routes together.

### 3.5 Song card

`SongList` `Props` gain `onPerform: (song: Song) => void` (required, like
the other handlers); `SongCardItem` renders the button for every role.
`SongsView` passes `navigate(`/songs/${song.id}/perform`)`.

### 3.6 i18n (both locales)

```
songs.perform         Perform
songs.backToSongs     Back to songs
songs.notFound        Song not found
songs.loadError       Could not load the song
```

## 4. Acceptance criteria

`[unit]` Vitest, `[UI]` dev server.

- AC1 `[unit]` `performanceTargetKey({kind:"setlist",setlistId:"s1"})` → "s1";
  `({kind:"song",songId:"x"})` → "song:x".
- AC2 `[unit]` Controller: song target opens the `song` source only, with
  the flag on or off, online or offline; never touches `snapshot`;
  `unavailableOffline` stays false; a load error maps to `network`.
- AC3 `[unit]` Controller: setlist target behaves exactly as before
  (existing tests pass unchanged apart from the option rename).
- AC4 `[unit]` `performanceCapabilities` for a song target: reorder, sync and
  notes false for every role; upload true for member online, false for
  guest, false offline. Setlist rows of the table unchanged.
- AC5 `[unit]` Song source: `load` builds the synthetic setlist with one
  item at position 0, `name === song.title`, `band_id` from the song; a song
  from another band or no row → `not-found`; sheet music failure → stale
  flag with rows still emitted; `refresh` keeps `setlist` identity;
  `saveOrder` rejects; `savePreference` calls `setMySheetMusicPreference`.
- AC6 `[unit]` `AppMain`: `/songs/s1/perform` offline (flag on) renders
  `NeedsConnection`; online renders the song view (mocked).
- AC7 `[unit]` `SongList` (jsdom): the Perform button renders with
  `canEdit={false}` and calls `onPerform(song)` without expanding the card.
- AC8 `[unit]` Position: `readPerformPosition(uid, "song:x")` round-trips
  and `clearAllPerformPositions` removes it (existing prefix logic; one
  added case).
- AC9 `[UI]` From `/songs`, Perform on a song with chords, lyrics and two
  PDFs: the view opens on that song; chords/lyrics/sheet music switch; PDF
  pages turn with arrows; the chosen PDF is remembered on reopen; "Add PDF"
  works as member; fullscreen and font size work; X and Escape return to
  `/songs`.
- AC10 `[UI]` As guest: Perform is visible and works; no Add PDF.
- AC11 `[UI]` None of: sidebar, "Up next", counter, progress bar, Prev/Next,
  Reorder, Sync controls, Offline toolbar button, notes, snapshot badge.
  `r` and `l` do nothing.
- AC12 `[UI]` A setlist perform session is untouched: open
  `/setlists/:id/perform` before and after; sync host/viewer still works
  (smoke), reorder still works, offline snapshot still renders with the flag
  on.
- AC13 `[UI]` A deleted or foreign song id shows "Song not found" + Back.
- AC14 `[UI]` The PWA update prompt does not appear on the song perform
  route while an update is pending.
- AC15 `npm run lint`, `npm run build`, `npm test` pass; new strings in both
  locales.

## 5. Tests

- `src/hooks/__tests__/performanceTarget.test.ts` — AC1.
- `src/hooks/__tests__/performanceDataController.test.ts` — AC2–AC4 added
  to the existing file (fake sources gain a `song` one).
- `src/hooks/__tests__/songPerformanceDataSource.test.ts` — AC5, services
  mocked like `snapshotPerformanceDataSource.test.ts`, fixtures from
  `src/test/performFixtures.ts`.
- `src/__tests__/AppMain.test.tsx` — AC6 added.
- `src/components/__tests__/SongList.test.tsx` — AC7 (new file).
- `src/lib/__tests__/performPosition.test.ts` — AC8 one case.
- Manual: AC9–AC14 in the PR description, including the setlist regression
  smoke (AC12) with two devices for sync.

## 6. Risks

- **The view is 3 000 lines.** The gating is a dozen `isSong &&` checks and
  four navigation targets; the temptation is to "clean up while here".
  Don't: PR 1.2 is the gating only, so the diff stays reviewable and AC12
  stays credible.
- **Synthetic ids leaking.** `song:<id>` must never reach a service that
  expects a setlist row: `saveOrder` (blocked by capability), sync (disabled),
  `OfflineDownloadAction` (not rendered), `patchSnapshotSetlist` (snapshot
  source never opened). AC2/AC5/AC11 cover each.
- **Key collisions.** `performPositionKey` and the backing-track key
  interpolate the id; `song:` cannot collide with a UUID.
- **Offline follow-up** (decision 3) will need the target in the controller's
  snapshot lookup ("any snapshot containing this song"). The target type is
  designed so that is additive.

## 7. Out of scope

Sync for single songs (decision 4); offline single-song (decision 3);
a "next song" concept in song mode; showing the Perform action on the
songbook or in setlist editors; per-song backing-track sharing across
targets.

## 8. Files touched (expected)

```
src/hooks/performanceTarget.ts                     new
src/hooks/songPerformanceDataSource.ts             new
src/hooks/performanceDataSource.ts                 open(target), kind "song"
src/hooks/snapshotPerformanceDataSource.ts         open(target) guard
src/hooks/performanceDataController.ts             target, song source, capabilities
src/hooks/useSetlistPerformanceData.ts             target
src/components/SetlistPerformanceView.tsx          PerformanceView + wrapper, chrome gating, exitPath
src/components/SongPerformanceView.tsx             new (wrapper)
src/components/SongList.tsx, SongsView.tsx         Perform button
src/components/PwaReloadPrompt.tsx                 NO_RELOAD_ROUTES
src/AppMain.tsx                                    route
src/i18n/locales/en.json, es.json                  §3.6
tests per §5
CLAUDE.md                                          route table, hooks list, "Performance data" paragraph
README.md                                          Features: perform a single song
docs/specs/offline-performance-phase2-3.md         changelog line: target type, song follow-up
```

## 9. Phases and PRs

### Phase 1 — perform a single song

**Goal:** from `/songs`, any role opens one song in performance mode and
exits back to the library; setlist performance is unchanged.
**Closes:** AC1–AC15. **Validate (manual):** AC9–AC14, including the setlist
regression smoke (AC12) with two devices for sync; record the devices used.

- **PR 1.1 — data layer, no UI change.** §3.1–§3.3, the hook's `target`
  parameter, tests AC1–AC5, AC8. `SetlistPerformanceView` only wraps its
  param into a target. Behaviour identical; AC3 proves it.
- **PR 1.2 — route, view gating, song card.** §3.4–§3.6, tests AC6–AC7, the
  manual checklist AC9–AC14, docs.

Definition of done per PR: the `CLAUDE.md` checklist. The phase is done
when PR 1.2 merges with the manual checklist recorded in its description.
