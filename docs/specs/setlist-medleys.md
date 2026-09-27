# Spec: Medleys in setlists

> **Status:** draft · **Created:** 2026-09-27 · **Owner:** Renán Díaz
> **Origin:** "que se puedan armar medleys, juntando varias canciones como
> una sola, pudiéndose nombrar o no".
> **Scope:** group consecutive songs of a setlist into a named or unnamed
> medley that reads as one entry everywhere the setlist is shown, without
> changing how anything counts, navigates or stores songs. One phase,
> one PR (§8).
> Song *fragments* ("only the chorus of B") are v2 and excluded (§9).
> **Depends on:** nothing. [setlist-builder.md](setlist-builder.md) §3.4
> reserves the picker's "Add as medley" button for it.

This is a design, not code. Signatures are the contract; no bodies here.

## 0. Where we are

A setlist is a JSONB list of items (`Setlist.songs: SetlistItem[]`): songs
(`{ type: "song", song_id, position, notes? }`) and special items
(`break` / `section` / `note`, with a client-generated `id`). Fourteen files
walk that list with `isSongItem` & co. A *new item type* would touch all of
them; the table is the argument for the model chosen in §1:

| Consumer | What it does with song items |
|----------|------------------------------|
| `SetlistEditor` | drag-and-drop by `getSetlistItemKey`, notes, remove, AI "Optimize order" rebuilds the list from song ids per section |
| `SetlistDetailView` | numbered list, reorder mode, text export input, linked shows |
| `SetlistPerformanceView` + `usePerformItems` | one item per screen; `currentIndex` over the **whole** list (specials included); "Up next" reads `items[currentIndex + 1]` |
| `usePerformanceSync` | `performance_sessions.current_song_index` is that same index |
| `performPosition.ts` | saves `currentIndex` per user + setlist |
| `useLocalBackingTracks` | one file per song id |
| `PrintableSetlist`, `setlistText.ts` | numbered lines, sections/breaks, subtotals |
| `SetlistList`, `ShowDetailView`, `RehearsalDetailView`, `OfflineSetlistDetail` | count or list songs via `filter(isSongItem)` |
| `reportsService` | usage counts per song id across setlists |
| `performanceDataSource`, `offlineSetlistService` | `referencedSongIds` → `getSongsByIds`, sheet music, snapshot files |
| `aiSetlistService` | `parseSetlistSections` and the optimize prompt work on song ids |

## 1. Decisions

1. **A medley is a grouping of consecutive song items, not a container
   item.** Each member keeps its `type: "song"` row and gains an optional
   `medley` field (§2). The list stays flat, so every consumer above keeps
   working unchanged: indexes, sync, saved position, backing tracks,
   reports, `referencedSongIds`, sheet music, offline files.
2. **Only rendering changes.** The places that *show* a setlist group the
   members visually through one util (`groupSetlistItems`, §4); the places
   that *count* or *navigate* do not change. Performance mode still shows
   one song per screen; it adds a "Medley · 2/3" badge.
3. **Members are consecutive**, and every write guarantees it: the editor
   moves a medley as one block, and `normalizeMedleys` (run on read and
   before every save) repairs anything else — a medley with a gap keeps
   its first contiguous run, a medley with one member is dissolved.
4. **Name is optional.** Named: `Medley: Beatles`. Unnamed: the member
   titles joined by ` → ` with a "medley" tag. The label lives on every
   member (kept in sync by normalization) so a member read alone still
   knows its medley.
5. **Two or more members**, songs only. Breaks, sections and notes cannot
   be inside a medley; a medley cannot span a section. Grouping across a
   special item moves the members together next to the first one.
6. **A member counts as a played song** in reports and in the song count.
   A setlist with `A → B → C` has three songs and one medley. Numbering in
   detail, print and export counts the medley as **one** line (§3.3) but
   the panel stats keep the song count.
7. **Duration is the sum of the members.** It overestimates when a medley
   plays fragments; v2 fixes that with fragments, not with an override.
8. **Per-song data stays per song:** notes, transposition, sheet music,
   backing tracks, preferred PDF. A medley has a label and nothing else.
9. **Optimize order keeps medleys intact** by post-processing the
   suggested order (`regroupMedleys`, §4), not by prompting.
10. **No offline schema bump.** The field rides inside the setlist row's
    JSONB; snapshots made before this PR render as plain songs.

## 2. Data

```ts
// src/services/setlistsService.ts
export interface SetlistMedleyRef {
  /** Client-generated, unique within the setlist (`generateSetlistItemId`). */
  id: string;
  /** Optional display name; identical on every member (normalized). */
  label?: string;
}

export interface SetlistSongItem extends SetlistItemBase {
  type: "song";
  song_id: string;
  notes?: string;
  medley?: SetlistMedleyRef;
}
```

Stored example (positions omitted):

```json
[
  { "type": "section", "id": "item-…", "label": "Set 1" },
  { "type": "song", "song_id": "a" },
  { "type": "song", "song_id": "b", "medley": { "id": "item-m1", "label": "Beatles" } },
  { "type": "song", "song_id": "c", "medley": { "id": "item-m1", "label": "Beatles" } },
  { "type": "song", "song_id": "d", "medley": { "id": "item-m1", "label": "Beatles" } },
  { "type": "song", "song_id": "e" }
]
```

No migration: the column is JSONB. Legacy items without `type` keep going
through `normalizeSetlistItem` and never carry `medley`.

## 3. UX

### 3.1 Editor

- **Create:** select two or more song rows in the setlist (the row
  checkbox from [setlist-builder.md](setlist-builder.md) §3.4, or `⌘`/`Ctrl`
  +click on pointer) → **Group as medley** in the selection footer. Members
  move next to the first selected one, in setlist order. A name prompt
  (inline input on the group header, empty allowed) opens focused.
  From the picker: **Add as medley** adds the selection as a new medley at
  the end.
- **Render:** members are drawn inside a bracket card with a header row:
  `♪ Medley · Beatles` (editable name, `✎`), member count, duration sum,
  and a `⋮` menu: **Rename**, **Ungroup**, **Remove medley** (removes the
  members). Members keep their own row: position number, notes, edit song,
  remove (removing one leaves the rest; one member left → the medley
  dissolves, with a toast).
- **Drag:** the medley header is the drag handle for the whole group; a
  member's own handle reorders it **within** the medley. Dropping a
  non-member into a medley's middle is not possible (dnd-kit sortable ids:
  the group is one sortable, members are a nested sortable). The row menu's
  Move up/down/top/bottom act on the whole medley from its header and on
  the member within the medley from a member row.
- **Save:** `normalizeMedleys` runs before `updateSetlist`.

### 3.2 Detail view and reorder mode

Read-only bracket card with the same header; members listed inside with
their key/BPM/duration badges. Reorder mode moves the medley as a block
(same nested-sortable rule). Song count in the header stays the song count.

### 3.3 Print and text export

One numbered line per medley, in every text layout, then the members:

```
 4  Medley: Beatles  (11:20)
    Something → Come Together → Here Comes the Sun
```

`stage` prints only the first line plus the `→` line; `technical` prints
the medley line with the summed duration and start, then one indented row
per member with its own key/BPM/duration and no start; `message` prints
`4. *Medley: Beatles* — Something → Come Together → Here Comes the Sun`.
Unnamed medleys print `4  Something → Come Together → Here Comes the Sun
(medley)`. Song notes of members print under their member row as today.
Numbering counts the medley once (decision 6). `PrintableSetlist` mirrors
the `stage` shape.

### 3.4 Performance mode

- The current item's header shows a badge `Medley · Beatles · 2/3` (or
  `Medley · 2/3`) when the current song is a member.
- **Up next** shows the next member with the same badge (`Up next: Come
  Together · medley 2/3`); leaving the medley shows the next item as today.
- The sidebar list groups members under a small medley header (indent +
  label); tapping a member still jumps to it.
- Navigation, keyboard shortcuts, sync, saved position, reorder on the fly:
  unchanged. Reorder mode in perform uses the same nested-sortable rule as
  the editor.

### 3.5 Lists that count or list songs

`SetlistList` (song count), `ShowDetailView` / `RehearsalDetailView` (song
lists) keep `filter(isSongItem)`; `RehearsalDetailView` / `ShowDetailView`
*may* render the `→` grouping through `groupSetlistItems` for consistency,
not required in the PR. `OfflineSetlistDetail` renders the bracket card
(read-only) since it is the offline stand-in for the detail view.

### 3.6 AI "Optimize order"

`handleApplyOptimization` passes the rebuilt list through `regroupMedleys`
(members follow their first member, in the model's relative order) before
setting the items. The prompt is untouched; the preview modal shows the
regrouped order.

## 4. Contract

```ts
// src/services/setlistsService.ts
export function isMedleyMember(item: SetlistItem): item is SetlistSongItem & { medley: SetlistMedleyRef };

/** Enforce §1 #3–#5: members consecutive (first run kept, the rest lose the field),
 *  ≥ 2 members (singletons lose the field), labels copied from the first member,
 *  positions reindexed. Idempotent. Called by normalizeSetlistItems and before every save. */
export function normalizeMedleys(items: SetlistItem[]): SetlistItem[];

// src/utils/setlistGroups.ts  (pure)
export type SetlistGroup =
  | { kind: "item"; item: SetlistItem; index: number }
  | { kind: "medley"; id: string; label?: string; members: SetlistSongItem[]; firstIndex: number };

/** Items in order, with consecutive medley members folded into one group.
 *  `index` / `firstIndex` are positions in the flat list (perform mode's currentIndex). */
export function groupSetlistItems(items: SetlistItem[]): SetlistGroup[];

/** "Medley: Beatles" or "A → B → C" (titles resolved through songsById; missing → skipped). */
export function medleyTitle(group: Extract<SetlistGroup, { kind: "medley" }>, songsById: ReadonlyMap<string, Song>, t: Translate): string;

/** Position of `index` inside its medley, 1-based, and the size; undefined when not a member. */
export function medleyPosition(items: SetlistItem[], index: number): { position: number; size: number; label?: string } | undefined;

/** Members selected (song ids) become one medley placed at the first member's slot,
 *  in setlist order; returns the new list and the medley id. Ignores non-songs. */
export function groupAsMedley(items: SetlistItem[], songIds: string[], label?: string): { items: SetlistItem[]; medleyId: string };
export function ungroupMedley(items: SetlistItem[], medleyId: string): SetlistItem[];
export function renameMedley(items: SetlistItem[], medleyId: string, label: string | undefined): SetlistItem[];

/** Reorder `items` to follow `songOrder` (ids), then pull every medley's members
 *  behind its first member, keeping their relative order. Specials keep their slots. */
export function regroupMedleys(items: SetlistItem[], songOrder: string[]): SetlistItem[];

/** Sum of member durations in seconds (missing → 0). */
export function medleyDuration(members: SetlistSongItem[], songsById: ReadonlyMap<string, Song>): number;
```

`setlistText.ts` gets a `medley` row kind in `buildRows` (the internal row
model) and renders §3.3; `setlistPlan.ts` / `setlistTextDurations` need no
change (they sum song items).

i18n: `setlists.medley.*` — `medley`, `groupAsMedley`, `addAsMedley`,
`rename`, `ungroup`, `removeMedley`, `namePlaceholder`, `badge` (`Medley ·
{{label}} · {{position}}/{{size}}`), `unnamedSuffix` (`(medley)`),
`dissolved` toast. Both `en.json` and `es.json`.

## 5. Permissions and offline

- Creating, renaming and ungrouping are setlist edits: `canEditContent`,
  as every other item change. Guests see the grouping read-only.
- Offline: the snapshot's `setlist.songs` carries the field; `getSnapshot`
  → `normalizeSetlistItems` applies `normalizeMedleys`, so a snapshot with a
  broken group (a member removed by an older client) still renders. No
  `OFFLINE_SCHEMA_VERSION` change; `referencedSongIds` unchanged.
- `performance_sessions` and `performPosition` untouched (flat index).
- No table, RLS or migration changes.

## 6. Acceptance criteria

1. Selecting songs 2, 5 and 3 (in that setlist order) and grouping produces
   one medley at slot 2 with members `2, 3, 5`; the others shift down.
2. Renaming writes the label on every member; the stored JSON shows the
   same `medley.label` on each; an empty name clears it.
3. Dragging the medley header moves all members as a block; a member's
   handle only reorders inside; a foreign song cannot land between members.
4. Removing a member from a two-song medley leaves a plain song and a
   toast; ungrouping leaves the songs in place without the field.
5. Detail, print and every text layout number the medley once and list the
   members with `→`; the `technical` duration column shows the sum; a
   member's note prints under the member.
6. Performance mode: the badge reads `Medley · Beatles · 2/3` on the second
   member, "Up next" names the third member, and `currentIndex` /
   sync / saved position behave exactly as before the PR for the same
   setlist (regression test on `usePerformItems` with grouped fixtures).
7. Reports: the song usage count of each member increments by one for the
   setlist.
8. Optimize order on a setlist with a medley returns members adjacent, in
   the model's relative order.
9. An old offline snapshot (no `medley` field) opens as today; a snapshot
   with a one-member medley opens as a plain song.
10. Spanish UI: no English label. No `alert` / `confirm`; no console
    errors.

## 7. Tests

Node:

- `src/services/__tests__/setlistsService.medleys.test.ts`:
  `normalizeMedleys` (gap → first run kept; singleton dissolved; labels
  synced from the first member; idempotent; positions reindexed).
- `src/utils/__tests__/setlistGroups.test.ts`: `groupSetlistItems`
  (medley inside a section, two medleys back to back, medley at the end),
  `medleyTitle` named/unnamed/missing song, `medleyPosition`,
  `groupAsMedley` (order, across a section, ignores specials),
  `ungroupMedley`, `renameMedley`, `regroupMedleys` (members split by the
  model, specials keep slots), `medleyDuration`.
- `src/utils/__tests__/setlistText.test.ts` (extend): the three layouts
  with a named and an unnamed medley, numbering, member notes.
- `src/utils/__tests__/performItems.test.ts` (extend): grouped fixtures
  keep `indexAfterItemsChange` behaviour.

DOM: editor bracket card render (group, rename, ungroup call the utils);
performance badge and "Up next" for a member (render test with the test
i18next instance).

## 8. Phases and PRs

### Phase 1 — medleys

**Goal:** a band groups consecutive songs into a named or unnamed medley
that reads as one entry in the editor, detail, print, text export and
performance mode, with counting, navigation and sync unchanged.
**Closes:** AC1–AC10. **Validate (manual):** AC1–AC6 and AC8 in the dev
server, AC9 with an offline snapshot made before the change.

**PR 1.1 — medleys**, in this order inside it:

1. Data + utils + tests (§2, §4, §7).
2. Editor: selection → Group as medley, bracket card, nested sortable,
   menu; save through `normalizeMedleys`; Optimize order regroup.
3. Detail (read-only + reorder), offline detail, print, text export.
4. Performance mode badge, "Up next", sidebar grouping.
5. i18n, README **Features** (Setlists): "Medleys: group songs into one
   named entry"; CLAUDE.md schema table (`setlists` row: song items may
   carry `medley { id, label? }`).

If the PR grows past review size, split after step 3: PR 1.1 is steps 1–3
(data, editor, views) and PR 1.2 is performance mode (step 4) plus step 5.
Both stay in Phase 1; the data model is complete after step 1 either way,
and the phase is validated once both merge.

## 9. Out of scope (v2 candidates)

- **Fragments.** Most medleys play parts: the chorus of B between two
  verses of A. That needs a per-member range (`sectionStart` /
  `sectionEnd` over `timing_data` section names, which already exist for
  songs with sections), performance mode showing only that part of the
  lyrics/chords, and a duration that is no longer the sum. It is the real
  depth of the feature and deserves its own spec once v1 is in use. Until
  then, a member's `notes` ("solo coro") carries the instruction.
- **Key per member.** Medleys often re-key a song to match the previous
  one. Transposition is per song today; a per-member override would need
  the perform view to transpose from the setlist item, not the song.
- **Reusable medleys.** A band plays the same medley across setlists. v1
  copies the grouping when a setlist is duplicated
  ([setlist-builder.md](setlist-builder.md) §4.3) and nothing else. A
  "medley library" would promote the medley to a song-like entity; wait
  for the demand.
- **Nested medleys, medleys across sections, medleys with breaks or notes
  inside.**
- **AI awareness.** The generator does not propose medleys; Optimize order
  only keeps them intact (§3.6).

## 10. Open questions

1. **Numbering.** Decision 6 numbers a medley once (`4  Medley: …`). A
   band that counts songs on stage may prefer `4–6`. Ship with once;
   make it a text-export option if asked.
2. **Sync sessions on old clients.** A viewer on a build before this PR
   shows the members as plain songs and follows the same index; nothing
   breaks. Confirm during the device checklist.
3. **Performance sidebar density.** Grouping adds a header row per medley;
   on a phone the sidebar is already tight. Try indent-only first.
