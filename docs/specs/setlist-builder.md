# Spec: Setlist builder — creating a setlist from scratch

> **Status:** in progress — Phase 1: PR 1.1 done, PR 1.2 pending · **Created:** 2026-09-27 · **Owner:** Renán Díaz
> **Origin:** the editor works when you already know which songs go in, and
> gives no help when you don't ("sin tenerlo en papel").
> **Scope:** turn the setlist editor from an *ordering* editor into a
> *selection* editor: a song picker with history signals and filters,
> multi-select, touch-first reordering, a plan bar with a target duration,
> structure templates, "start from a copy", and a candidates list. Three
> phases, four PRs (§10), no AI calls. §11 documents the AI follow-up that
> is **not** scheduled.
> **Pairs with:** [setlist-medleys.md](setlist-medleys.md) (the picker's
> multi-select is its entry point, §3.6). Independent of
> [themed-setlists.md](themed-setlists.md).

This is a design, not code. Signatures are the contract; no bodies here.

## 0. Where we are

`SetlistEditor.tsx` (≈1 950 lines, route `/setlists/:setlistId/edit`) has two
panels: **Song Library** (search, one "+" per row, songs already in the
setlist hidden) and **Setlist** (drag-and-drop, per-song notes, special
items, "Optimize order" with Groq). It is a good *ordering* editor. Building
a setlist from nothing is a *selection* problem — pick N of M under a time
budget, with criteria — and for that the screen has nothing:

| # | Gap | Where |
|---|-----|-------|
| 1 | The library is a flat A→Z list (artist, title). Search matches title and artist only; the filters of `SongsView` (`SongSearchFilter`, `songFilters.ts`) are not available | `filteredAvailableSongs`, `SetlistEditor.tsx:621` |
| 2 | No signal to choose by: times played, last played, never played, energy, language. The data exists (`reportsService.getMostUsedSongs` counts setlist usage; `shows.setlist_id` + `event_date` + `status` give "last played") but never reaches the editor | — |
| 3 | No budget. The total duration shows after adding; there is no target to compare against, no per-section subtotal | `PanelStats` |
| 4 | Every setlist starts empty. No duplicate, no template ("2 sets + break"), no "start from the last show's setlist" | `NewSetlistForm`, `SetlistList` |
| 5 | Adding commits a position at the end. No staging area to shortlist 30 and keep 18 | `handleAddSong` |
| 6 | Touch: `PointerSensor` with `distance: 8` only, no long-press activation, no `touch-action: none` on the handle, no non-drag way to move an item. Same in `SetlistDetailView` (reorder) and `SetlistPerformanceView` | `useSensors` in the three views |
| 7 | Narrow screens stack both panels; the library scrolls inside a `max-height: calc(100vh - 280px)` box above the setlist. Fine to find a known song, bad to browse | `EditorGrid`, `SongLibraryPanel` |
| 8 | Creating a setlist stays on `/setlists`; building means one more tap to "Edit songs" | `NewSetlistForm.onSetlistCreated` |

Not a problem: the AI generator (`AISetlistGenerator`, on `/setlists`) and
"Optimize order" stay as they are. They depend on a Groq key that is
exposed in the bundle and rate-limited, so they are not part of this design
(§11).

Data available without new tables: `Song` (`key`, `tempo`, `duration` in
seconds, `energy`, `tags`, `language`, `country`, `release_date`,
`created_at`), `Setlist.songs: SetlistItem[]` with `is_draft`, `created_at`,
`updated_at`, `Show` (`setlist_id`, `event_date`, `status`, `name`,
`venue`). The editor already loads `getSetlist` + `getBandSongs`; §6 adds
`getBandSetlists` + `getBandShows` (two reads).

## 1. Decisions

1. **The editor keeps its shape** — setlist on one side, songs on the other —
   and the library panel becomes a `SongPicker` component in
   `src/components/setlist-builder/`. `SetlistEditor.tsx` does not grow:
   every new piece is its own file (§6).
2. **Signals are computed on the client** by a pure util
   (`src/utils/songSignals.ts`) from the songs, the band's non-draft
   setlists and its shows. "Played" means a **completed show** linked to a
   setlist that contains the song; "in a setlist" is the weaker signal and
   is shown when there are no completed shows. No new columns, no reports
   service call.
3. **Filters reuse `songFilters.ts`** and extend it with value filters (tag,
   key, language, energy band, played status). `SongsView` keeps its
   current behaviour; the new filters are additive.
4. **Multi-select and "Add N" are the base path** on every input; the
   single "+" and drag-to-insert are shortcuts for pointer users. Nothing is
   reachable only by hover, nothing only by drag (§2).
5. **Reordering gets a touch path**: long-press drag (`TouchSensor`) plus a
   row menu with Move up / down / to top / to bottom. One shared sensors
   hook, applied to the editor, the detail reorder and performance mode's
   reorder.
6. **Target duration is stored on the setlist** (`setlists.target_minutes`,
   nullable). This is the spec's only schema change and it is deliberate:
   the band shares the target (the detail view shows "48 / 60 min" too),
   and a device-local target would show a different number to each member.
   The migration is one idempotent `ALTER TABLE`; the existing UPDATE
   policy covers the column. If the migration is not wanted in PR 2.1, the
   fallback is device-local storage with the same UI; say so in the PR.
7. **Templates are items, not a new concept**: "Two sets + break" is two
   `section` items and one `break` item, created with the setlist.
8. **Copy is a client-side create**: `duplicateSetlist` reads the source and
   calls `createSetlist` with its items (special-item ids regenerated,
   notes kept, `is_draft: false`). No server function.
9. **Creating navigates to the editor.** After "Add setlist" the user lands
   on `/setlists/:id/edit`; the list refreshes when they come back.
10. **Candidates are device-local** (`localStorage`, per user and setlist,
    like `performPosition`). Persisting them in the JSONB would change the
    item contract and the offline snapshot for a feature whose value is
    still a hypothesis. Revisit when a band asks to share a shortlist.
11. **No AI in this spec.** The generator and "Optimize order" are untouched;
    §11 records the future direction so it does not have to be rediscovered.

## 2. Screen sizes and input

Two independent axes. **Width** decides the layout; **input capability**
decides the affordances. Detect input with
`(hover: hover) and (pointer: fine)` (`useInputCapabilities`, §6.5), never
with the user agent: an iPad with a trackpad gets pointer affordances, a
touch laptop gets touch affordances when touched. Width uses the existing
`lg` breakpoint (`theme.breakpoints.lg`, 992 px), the one `EditorGrid`
already collapses at.

| | Pointer | Touch |
|---|---|---|
| **Wide (≥ lg)** | Two panels, as today. Row actions on hover. Keyboard: `Enter` adds the first result, `↑`/`↓` move the highlight, `Delete` removes the highlighted setlist row, `/` focuses the search. Drag a library row into the setlist at a position (dnd-kit multiple containers). | Two panels. Row actions always visible, targets ≥ 44 px. Tap a row to select; "Add N" in the picker footer. Long-press drag to reorder, plus the row menu. |
| **Narrow (< lg)** | One column: the setlist is the page. "Add songs" opens the picker as a full-screen sheet (search, filters, sort, multi-select, "Add N" footer). Sticky footer: songs · duration / target · Save. | Same as narrow pointer, with touch affordances: long-press drag, row menu, swipe-left to remove (optional, §12). |

Rules that hold in every cell:

- Every row action (add, remove, notes, edit song, move) exists as a visible
  or menu button on touch; hover only *reveals* on pointer.
- Drag is never the only way to move or insert.
- Focus returns to the search after an add only on wide + pointer (as
  today, `handleAddSong`); on touch the picker keeps the scroll position.
- The full-screen picker keeps its filters and selection while open;
  closing it (Add N or Close) returns to the setlist without a route change.

## 3. Song picker (Phase 1)

### 3.1 Rows

Each row: title, artist, the existing badges (key, BPM, duration), and one
**signal line**:

| Situation | Line |
|-----------|------|
| played in ≥ 1 completed show | `Played 4× · last: Casa Bruja, 12 Jun` |
| in ≥ 1 non-draft setlist, never in a completed show | `In 3 setlists · never played` |
| in no setlist | `Never in a setlist` |

Dates use the app locale (`Intl.DateTimeFormat`, day + short month;
year added when not the current year). Venue falls back to the show name.
Copy under `setlists.picker.signals.*` with plurals.

### 3.2 Filters

Chips above the list, collapsed into a "Filters" button below `md`. Each
chip opens a small popover with checkboxes (multi-value, OR within a chip,
AND across chips):

- **Tags** — distinct `song.tags`, sorted; hidden when no song has tags.
- **Key** — distinct `song.key`.
- **Language** — distinct `song.language`; hidden with fewer than two.
- **Energy** — `low` / `medium` / `high` bands over `song.energy` (0–1,
  Spotify scale); thresholds in `songFilters.ts` (`< 0.4`, `0.4–0.7`,
  `≥ 0.7`; confirm against the catalog at implementation), hidden when no
  song has energy.
- **Played** — `never played`, `not played in 6 months`, `played`.

Search reuses `filterBySearch` (title, artist, **tags**). The count in the
panel header is the filtered count, as today. "Clear filters" appears when
any filter is active.

### 3.3 Sort

`Most played`, `Longest since played` (never-played first, then oldest
`lastPlayedAt`), `Recently added` (`created_at` desc), `Artist, title`
(default, as today), `Title`. Sorting is a `PickerSort` (§6.2), stored per
device with the filters (`bandmate_setlist_picker`, one JSON object, parsed
with try/catch and validated field by field).

### 3.4 Selection and add

- **Touch, any width:** tapping a row toggles it; the footer shows
  `Add 7 songs` (primary) and `Clear`. The "+" per row is kept for a single
  add.
- **Pointer, wide:** "+" adds at the end immediately (today's behaviour).
  A checkbox at the row start selects; `Shift`+click selects a range.
  "Add N" appears when the selection is not empty.
- Added songs are inserted **at the end** in the order selected, or at the
  drop position when dragged in. Songs already in the setlist stay hidden
  from the picker, as today.
- **Add as medley** is a second footer button, present in the contract
  (`onAddSelected(songs, { asMedley })`) and **hidden** until
  [setlist-medleys.md](setlist-medleys.md) ships.

### 3.5 Reordering on touch

`useSortableSensors()` (§6.5) returns `MouseSensor` (distance 8) +
`TouchSensor` (`delay: 250, tolerance: 5`) + `KeyboardSensor`, replacing the
bare `PointerSensor` in the editor, `SetlistDetailView` (reorder mode) and
`SetlistPerformanceView` (reorder mode). The drag handle gets
`touch-action: none`. Every sortable row gets an overflow menu (`⋮`) with
**Move up**, **Move down**, **Move to top**, **Move to bottom**, **Remove**;
on pointer the menu exists too (keyboard users), the icons stay.

### 3.6 Empty and edge states

- Library empty: "No songs in library" + link to `/songs` (as today).
- Everything added: "All songs added" (as today).
- Filters hide everything: "No songs match these filters" + Clear filters.
- Shows/setlists fail to load (signals only): the picker renders without
  the signal line and without the Played chip; no toast (the editor's own
  load error keeps today's toast + redirect).

## 4. Plan bar, templates, start from (Phase 2)

### 4.1 Plan bar

Above the setlist list, replacing today's `PanelStats` line:

```
12 songs · 48:20 of music · 58:20 with breaks     Target [ 60 ] min  ████████░░ 48 / 60
```

- Target is a number input (minutes), empty allowed. Saved with the setlist
  (`target_minutes`, decision 6).
- Progress uses **music + breaks** vs target; over target turns the bar
  amber and the text `62 / 60 (+2)`. No hard limit.
- Each `section` row shows its subtotal (songs + breaks up to the next
  section) at its right, using the same rule `setlistText.ts` already
  applies to the `technical` layout (§6.3 extracts it).
- `SetlistDetailView` shows target and progress in its header when a target
  exists (read-only).

### 4.2 Templates

`NewSetlistForm` gets a **Start from** control: `Blank` (default),
`Template ▾`, `Copy of… ▾`. Templates (`SETLIST_TEMPLATES`, §6.4):

| id | Items |
|----|-------|
| `single-set` | `section "Set"` |
| `two-sets-break` | `section "Set 1"`, `break "Break" 15 min`, `section "Set 2"` |
| `two-sets-encore` | the above + `section "Encore"` |

Labels are localised at creation time (they become user text afterwards).
The AI generator's "Save & Edit" is untouched.

### 4.3 Copy of a setlist

- `Copy of…` lists the band's non-draft setlists (name, song count,
  updated date). The name field pre-fills `"{name} (copy)"`; description is
  copied.
- `SetlistList` card menu gets **Duplicate** (same service call; name
  `"{name} (copy)"`, then navigates to the editor).
- The linked-show badge is **not** copied (shows link to one setlist).

### 4.4 Creating navigates

`NewSetlistForm` (and Duplicate) navigate to `/setlists/:id/edit` after
creating. `onSetlistCreated` stays for the list refresh on return.

## 5. Candidates (Phase 3)

A third state between "in the library" and "in the setlist".

- In the picker, each row gets a **star** toggle (`Candidate`). The picker
  header gets a segmented control `All · Candidates (7)`.
- Candidates are songs, not positions. Adding a candidate to the setlist
  removes it from the candidates list. Removing a song from the setlist does
  not make it a candidate.
- Stored per user and setlist in `localStorage`
  (`bandmate_setlist_candidates_{userId}_{setlistId}`: `string[]` of song
  ids, 30-day expiry, read with try/catch). `wipeAll()` clears these keys
  like it clears `bandmate_perform_position_*` (one more prefix in the same
  loop, with a test).
- Setlist panel empty state, when candidates exist: "No songs yet — 7
  candidates waiting" with a button that opens the picker on the
  Candidates tab.

## 6. Contract

### 6.1 Signals — `src/utils/songSignals.ts`

```ts
export interface SongSignals {
  songId: string;
  /** Completed shows whose linked setlist contains the song. */
  timesPlayed: number;
  /** Non-draft setlists containing the song. */
  timesInSetlists: number;
  /** event_date of the latest completed show, YYYY-MM-DD. */
  lastPlayedAt?: string;
  lastPlayedShow?: { id: string; name: string; venue?: string };
  /** updated_at of the latest non-draft setlist containing the song. */
  lastInSetlistAt?: string;
}

export interface SongSignalsInput {
  songs: Pick<Song, "id">[];
  setlists: Pick<Setlist, "id" | "songs" | "is_draft" | "updated_at">[];
  shows: Pick<Show, "id" | "name" | "venue" | "setlist_id" | "event_date" | "status">[];
}

/** One entry per song in `songs`, in the same order. Pure. */
export function computeSongSignals(input: SongSignalsInput): ReadonlyMap<string, SongSignals>;

export type PlayedStatus = "never" | "stale" | "played";
/** `stale`: played, but `lastPlayedAt` older than `staleAfterMonths` (default 6) at `today`. */
export function playedStatus(signals: SongSignals, today: string, staleAfterMonths?: number): PlayedStatus;
```

`reportsService.getMostUsedSongs` / `getUnusedSongs` may switch to
`computeSongSignals` for the counting; not required.

### 6.2 Filters and sort — `src/utils/songFilters.ts` (additive)

```ts
export type EnergyBand = "low" | "medium" | "high";
export function energyBand(energy: number | undefined): EnergyBand | undefined;

export interface PickerFilters {
  tags: string[];
  keys: string[];
  languages: string[];
  energy: EnergyBand[];
  played: PlayedStatus[];
}
export const EMPTY_PICKER_FILTERS: PickerFilters;

export type PickerSort =
  | "artist_title_asc" | "title_asc" | "date_desc"   // existing SortOption values
  | "most_played" | "longest_since_played";

export interface PickerState { filters: PickerFilters; sort: PickerSort }

/** OR within a filter, AND across filters; empty arrays match everything. */
export function filterByPicker(
  songs: Song[],
  filters: PickerFilters,
  signals: ReadonlyMap<string, SongSignals>,
  today: string,
): Song[];

export function sortForPicker(
  songs: Song[],
  sort: PickerSort,
  signals: ReadonlyMap<string, SongSignals>,
): Song[];

/** Distinct values present in the catalog, sorted; for the chips. */
export function pickerFacets(songs: Song[]): {
  tags: string[]; keys: string[]; languages: string[]; hasEnergy: boolean;
};

/** Parse the stored picker state; anything invalid falls back to defaults. */
export function parseStoredPickerState(raw: string | null): PickerState;
```

### 6.3 Plan — `src/utils/setlistPlan.ts`

```ts
export interface PlanProgress {
  songCount: number;
  musicSeconds: number;
  totalSeconds: number;       // music + breaks
  targetSeconds?: number;
  /** totalSeconds / targetSeconds, undefined without a target. */
  ratio?: number;
  overBySeconds?: number;     // only when over target
}
export function planProgress(
  items: SetlistItem[],
  songsById: ReadonlyMap<string, Song>,
  targetMinutes?: number | null,
): PlanProgress;

/** Seconds (songs + breaks) from each section item up to the next one; key = item id. */
export function sectionSubtotals(
  items: SetlistItem[],
  songsById: ReadonlyMap<string, Song>,
): ReadonlyMap<string, number>;
```

`setlistTextDurations` in `setlistText.ts` becomes a thin call to
`planProgress` (same numbers; its tests stay).

### 6.4 Service and templates

```ts
// src/services/setlistsService.ts
export interface Setlist { /* … */ target_minutes?: number | null }
export interface CreateSetlistInput { /* … */ target_minutes?: number | null }
export interface UpdateSetlistInput { /* … */ target_minutes?: number | null }

/** Reads `sourceId`, creates a new non-draft setlist in the same band with its
 *  items (special-item ids regenerated), description and target. */
export async function duplicateSetlist(sourceId: string, name: string): Promise<Setlist>;

// src/utils/setlistTemplates.ts
export type SetlistTemplateId = "single-set" | "two-sets-break" | "two-sets-encore";
export function templateItems(id: SetlistTemplateId, t: Translate): SetlistItem[];
export const SETLIST_TEMPLATES: readonly SetlistTemplateId[];
```

Migration `supabase/migrations/<ts>_setlists_target_minutes.sql`:
`ALTER TABLE public.setlists ADD COLUMN IF NOT EXISTS target_minutes integer
CHECK (target_minutes IS NULL OR target_minutes > 0);`. No policy change.

### 6.5 Hooks and components

```ts
// src/hooks/useInputCapabilities.ts
export interface InputCapabilities { hover: boolean; finePointer: boolean; wide: boolean }
/** matchMedia("(hover: hover) and (pointer: fine)") + the lg breakpoint; live. */
export function useInputCapabilities(): InputCapabilities;

// src/hooks/useSortableSensors.ts
export function useSortableSensors(): SensorDescriptor<SensorOptions>[]; // Mouse + Touch + Keyboard

// src/components/setlist-builder/SongPicker.tsx
export interface SongPickerProps {
  songs: Song[];                         // not yet in the setlist
  totalSongs: number;                    // library size: "no songs" vs "all added" (§3.6)
  signals: ReadonlyMap<string, SongSignals> | null; // null: signals failed to load (§3.6)
  candidates?: ReadonlySet<string>;      // Phase 3
  onToggleCandidate?: (songId: string) => void;
  onAdd: (song: Song) => void;           // single "+"
  onAddSelected: (songs: Song[], options: { asMedley: boolean }) => void;
  onEditSong?: (song: Song) => void;
  layout: "panel" | "sheet";             // wide vs narrow
  capabilities: InputCapabilities;
  onClose?: () => void;                  // sheet only
  today?: string;                        // YYYY-MM-DD, tests pin it
}

// src/components/setlist-builder/PlanBar.tsx
export interface PlanBarProps {
  progress: PlanProgress;
  targetMinutes: number | null;
  onTargetChange: (minutes: number | null) => void;
  readOnly?: boolean;                    // detail view
}

// src/components/setlist-builder/SetlistRowMenu.tsx  (Move up/down/top/bottom, Remove)

// src/lib/setlistCandidates.ts   (Phase 3, localStorage; same shape as performPosition.ts)
export function readCandidates(userId: string, setlistId: string): string[];
export function writeCandidates(userId: string, setlistId: string, songIds: string[]): void;
export function clearAllCandidates(): void;   // called by wipeAll
```

Browser calls (`matchMedia`, `localStorage`) stay in hooks and `src/lib/`;
the utils in §6.1–6.3 are pure and tested in node.

## 7. Permissions and offline

- The editor is reachable for roles with `canEditContent`, as today;
  `updateSetlist` / `createSetlist` throw `PermissionError` and the views
  toast `common.noPermission`. Guests never see Duplicate or Start from.
- `target_minutes` travels with the setlist row, so an offline snapshot made
  after Phase 2 carries it and `OfflineSetlistDetail` may show it; snapshots
  made before simply lack it. **No `OFFLINE_SCHEMA_VERSION` bump.**
- The editor is online-only (offline it renders `NeedsConnection`);
  nothing here changes that.
- Candidates keys are cleared by `wipeAll()` (§5); no other offline
  interaction.

## 8. Acceptance criteria

1. Picker rows show the signal line; a song in a completed show shows
   `Played n× · last: …` with that show's venue and date; a song only in
   setlists shows `In n setlists · never played`.
2. Filters combine as OR within a chip and AND across chips; `Never played`
   lists exactly the songs with `timesPlayed === 0`; `Clear filters` resets.
3. `Longest since played` orders never-played first, then by `lastPlayedAt`
   ascending.
4. On an iPad (no trackpad): tapping rows selects them, `Add 3 songs`
   appends the three in tap order, long-press drag reorders, the row menu
   moves an item up/down/top/bottom, and scrolling the list never starts a
   drag.
5. On a phone: the editor is one column, "Add songs" opens the full-screen
   picker, Add N returns to the setlist with the songs appended, the sticky
   footer shows count, duration/target and Save.
6. On desktop with a mouse: "+" still adds immediately; a library row can be
   dragged into the setlist between two rows; `Enter` in the search adds the
   first result; hover reveals row actions, which are also reachable by
   keyboard.
7. Plan bar: with target 60 and 58:20 total the bar reads `58 / 60`; adding
   a 5-minute song turns it amber and reads `63 / 60 (+3)`; clearing the
   target hides the bar's progress and keeps the totals.
8. Each section row shows its subtotal; it matches the `technical` text
   export's section subtotal for the same setlist.
9. Creating with `Two sets + break` lands in the editor with `Set 1`,
   `Break · 15 min`, `Set 2`; creating with `Copy of X` lands in the editor
   with X's items, notes and description, and a different id.
10. `Duplicate` from the list creates `"X (copy)"` and opens its editor;
    the original is unchanged; the copy has no linked show.
11. Candidates survive a reload and a navigation away and back; adding a
    candidate to the setlist removes its star; signing out clears them.
12. Filters and sort persist per device; corrupt stored JSON falls back to
    defaults without error.
13. Spanish UI shows no English label in the picker, plan bar, templates or
    menus. No `alert` / `confirm`; no console errors.

## 9. Tests

Node (no DOM):

- `src/utils/__tests__/songSignals.test.ts`: counts across draft/non-draft
  setlists; completed vs upcoming/cancelled shows; latest date wins; venue
  fallback to show name; song in no setlist; `playedStatus` at the 6-month
  boundary.
- `src/utils/__tests__/songFilters.test.ts` (extend): `energyBand`
  thresholds; `filterByPicker` OR/AND semantics, empty filters; `sortForPicker`
  for `most_played` and `longest_since_played` (never first, ties by title);
  `pickerFacets`; `parseStoredPickerState` with `null`, invalid JSON,
  unknown sort, wrong types.
- `src/utils/__tests__/setlistPlan.test.ts`: `planProgress` with/without
  target, over target, no durations; `sectionSubtotals` with breaks, a
  leading unsectioned run, empty sections; parity with
  `setlistTextDurations`.
- `src/utils/__tests__/setlistTemplates.test.ts`: item shapes, ids present.
- `src/lib/__tests__/setlistCandidates.test.ts`: read/write, expiry,
  corrupt value, `clearAllCandidates` leaves other keys.
- `offlineSetlistService` wipe test: `wipeAll` clears candidate keys.

DOM (`// @vitest-environment jsdom`, services mocked at the module
boundary):

- `SongPicker`: signal line per situation; selecting and `Add N` calls
  `onAddSelected` in tap order; filters change the rendered rows; touch
  capabilities render checkboxes and no hover-only controls.
- `PlanBar`: renders the three states (no target, under, over).
- `NewSetlistForm`: template creates the items; copy calls
  `duplicateSetlist` and navigates.

## 10. Phases and PRs

Each phase ships on its own and leaves the editor usable; Phase 3 can be
dropped without touching the others. AC13 applies to every phase.

### Phase 1 — pick songs with history, on any device

**Goal:** a band builds a setlist from the library using play history,
filters and multi-select, and reorders it on an iPad or phone.
**Closes:** AC1–AC6, AC12. **Validate (manual):** AC4 on an iPad without a
trackpad, AC5 on a phone, AC6 on desktop with a mouse.

**PR 1.1 — picker, signals, filters.**
- `songSignals.ts`, `songFilters.ts` additions, `useInputCapabilities`,
  `SongPicker`, the narrow-layout sheet, per-device picker state.
- `SetlistEditor` loads setlists + shows, passes signals; library panel
  replaced by `SongPicker`.
- i18n `setlists.picker.*`.
- Tests: `songSignals`, `songFilters`, `SongPicker` (§9).

**PR 1.2 — touch reorder.**
- `useSortableSensors`, `SetlistRowMenu`; sensors swapped in the three
  views (editor, detail reorder, performance mode reorder).
- The wide + pointer `Delete` shortcut on the highlighted setlist row (§2):
  it belongs with the row menu, so PR 1.1 left it out.
- i18n `setlists.rowMenu.*`.
- README **Features** (Setlists): "Song picker with play history, filters
  and multi-select; touch-friendly reordering".

### Phase 2 — plan the length and start from a shape

**Goal:** a setlist has a shared target duration with progress, and a new
setlist can start from a template or a copy.
**Closes:** AC7–AC10. **Validate (manual):** AC7–AC10; the PR notes the
policies checked for the migration.

**PR 2.1 — plan bar, templates, copy, navigate-to-editor.**
- Migration `target_minutes`; service types; `setlistPlan.ts`;
  `setlistTemplates.ts`; `duplicateSetlist`; `PlanBar` in editor and
  detail; section subtotals; `NewSetlistForm` Start from; `SetlistList`
  Duplicate.
- CLAUDE.md schema table (`setlists` row: `target_minutes`), migration
  note (policies checked: `setlists` UPDATE/INSERT unchanged).
- README **Features**: "Target duration with progress, structure templates,
  duplicate a setlist".

### Phase 3 — candidates

**Goal:** a member keeps a per-device shortlist of songs to consider for a
setlist.
**Closes:** AC11. **Validate (manual):** AC11, including sign-out.

**PR 3.1 — candidates.**
- `setlistCandidates.ts`, `wipeAll` prefix, picker star + tab, empty state.
- CLAUDE.md "Offline wipe rules" (one more localStorage prefix).

Docs: add this spec to `docs/README.md`, the README Documentation list and
CLAUDE.md "External Documentation" (done with this spec); update the status
line as phases complete.

## 11. Future: AI inside the builder (documented, not scheduled)

Not planned now; the current Groq free tier is rate-limited enough that the
generator goes unused, and paying per use is not feasible at the moment.
This section keeps the reasoning so the decision can be picked up later
without redoing it.

### 11.1 Why the current setup blocks any AI feature

- `VITE_GROQ_API_KEY` is inlined in the public bundle: anyone can read it
  and spend the quota (already listed as technical debt in CLAUDE.md).
- Each generation sends the whole catalog and up to five previous setlists;
  above 40 songs "compact mode" drops key, tempo and energy, so the model
  decides with less data while the request stays large.
- Responses are `JSON.parse` casts; invented song ids reach the preview
  ([themed-setlists.md](themed-setlists.md) §0 #3).

### 11.2 Direction

1. **Edge Function `ai-setlist`** (Deno, `supabase/functions/`): the
   provider key lives in `supabase secrets`; the function validates the
   caller's JWT, checks `band_members` for a `canEditContent` role, applies
   a per-band daily cap (a small `ai_usage_daily(band_id, day, count)`
   table), calls the provider, validates the response against the catalog
   (unknown and duplicate ids dropped) and returns typed JSON.
   `aiSetlistService.ts` calls the function; `groqService.ts` and
   `VITE_GROQ_API_KEY` go away.

   ```ts
   // POST /functions/v1/ai-setlist   Authorization: Bearer <user JWT>
   type AiSetlistRequest =
     | { action: "generate"; bandId: number; options: SetlistGenerationOptions }
     | { action: "optimize"; bandId: number; setlistId: string }
     | { action: "fill"; bandId: number; setlistId: string;
         candidateIds: string[]; targetMinutes: number; theme?: string };
   type AiSetlistError = { code: "unauthorized" | "forbidden" | "daily-cap" | "provider" | "invalid-response"; message: string };
   ```

2. **Provider and cost.** Anthropic's Messages API with the official
   TypeScript SDK (`npm:@anthropic-ai/sdk` in Deno). Estimate per
   generation: ≈ 8k input tokens (300-song catalog with all fields, prompt,
   two previous setlists) and ≈ 1k output:

   | Model | Input / output per 1M | Per generation | 10 per month |
   |---|---|---|---|
   | Claude Opus 5 | $5 / $25 | ≈ $0.07 | ≈ $0.65 |
   | Claude Sonnet 5 | $2 / $10 | ≈ $0.03 | ≈ $0.26 |
   | Claude Haiku 4.5 | $1 / $5 | ≈ $0.01 | ≈ $0.13 |

   Anthropic's default recommendation is Opus 5; at this volume the
   difference is cents. Log `usage` from day one to replace the estimate.

3. **Prompt changes**, independent of provider: put the catalog first with
   `cache_control` (1 h TTL) so a band's second request pays ≈ 10% for it
   and compact mode can go; use structured output (a JSON schema) instead
   of "respond with JSON"; when the editor already filtered, send the
   **candidates** (§3, §5) rather than the catalog.

4. **"Fill to target"** in the editor: with the plan bar's target and the
   current items as `mustInclude`, ask for songs that complete the
   remaining minutes from the current picker results; suggestions land in
   **Candidates**, never directly in the setlist.

When this happens, update [themed-setlists.md](themed-setlists.md) §1
("no new AI calls, same model and limits") in the same PR.

## 12. Open questions

1. **Swipe-to-remove on touch** (§2): cheap with dnd-kit off, but it
   conflicts with horizontal scroll inside the row and with long-press
   drag. Ship without it; add if the row menu feels slow.
2. **Signals from rehearsals.** `rehearsals` link to setlists too; "rehearsed
   n×" is a plausible fourth signal. Wait for a request.
3. **Target from the show.** A show has no expected duration; adding
   `shows.set_minutes` would let a linked show propose the target. Out of
   scope; note for the shows spec.
4. **Shared candidates.** If a band asks to see each other's shortlist,
   move candidates into the setlist JSONB (`candidates: string[]` beside
   `songs`) and through the offline snapshot; that is a PR of its own.
