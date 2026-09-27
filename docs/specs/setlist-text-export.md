# Spec: Setlist text export

> **Status:** implemented (PR 1: formatter + Copy; PR 2: modal) · **Created:** 2026-09-27 · **Owner:** Renán Díaz
> **Origin:** review of the current `.txt` export (two sample files: every
> song detail on, every song detail off).
> **Scope:** rewrite the text export of a setlist as a pure, tested
> formatter with three layouts, a live preview, Copy / Download / Share and
> remembered options. Two PRs (§8).

This is a design, not code. Signatures are the contract; no bodies here.

## 0. Where we are

The export lives in `SetlistDetailView.tsx`: an "Export" button opens a
modal with 8 checkboxes (`exportOptions`, all `true` by default) and
`handleExportAsText` builds a string and downloads it as a `.txt`.

Current output, every song detail on:

```
Strato
======

Songs: 6
Total Duration: 25:30

SETLIST
--------------------------------------------------

1. La Furia - Still Louder
   Key: Dm | Tempo: 195 BPM | Duration: 3:33

2. Karma - Still Louder
   Key: Em | Duration: 4:30
...
```

Problems, by impact:

| # | Problem | Where |
|---|---------|-------|
| 1 | Breaks, sections and notes are dropped: only `songsForReorder` is iterated, so "Set 1", "Encore", "Break 15 min", "Tuning change" never reach the file | `handleExportAsText` |
| 2 | Every label is hard-coded English (`Songs:`, `Key:`, `SETLIST`, `Duration`), no `t()` | same |
| 3 | Download is the only action; the real uses are pasting into WhatsApp, printing, sending to the sound engineer | modal footer |
| 4 | File name drops accents: `[^a-z0-9]` turns "Al Vacío" into `al_vac_o.txt` | same |
| 5 | Noise: a blank line after every song even with no details, a `SETLIST` header with 50 dashes, long labels (`Tempo: 195 BPM \| Duration: 3:33`) | same |
| 6 | The artist repeats on every line; for a band playing its own songs it is always the same | same |
| 7 | The total ignores break durations; no per-section subtotal | `calculateTotalDuration` |
| 8 | Options reset on every open; there is no preview, so 8 unlabelled-effect checkboxes are the only feedback | `useState(exportOptions)` |
| 9 | Durations over an hour print as `65:30` | `formatDuration` |
| 10 | The formatter is inline in a ≈1 500-line view, untestable | — |

Not a problem: song notes are looked up by `song_id`
(`getSetlistSongNotes`); the editor refuses duplicate songs
(`SetlistEditor.tsx:326`), so the lookup is correct. The new formatter reads
`item.notes` directly while walking the items anyway.

Data available: `Setlist.songs: SetlistItem[]` (song / break / section /
note, in order), `Song.duration` in **seconds**, `SetlistBreakItem.duration`
in **minutes**, `Song.key`, `Song.tempo`, `Song.artist`, and the linked
shows (`linkedShows`, from `getShowsBySetlistId`) with `name`, `event_date`,
`event_time`, `venue`.

## 1. Decisions

1. **Pure formatter in `src/utils/setlistText.ts`.** Input: the setlist's
   items, the songs by id, the options, a translate function and a locale.
   Output: a string. No React, no `window`, no service calls. Preview, Copy,
   Download and Share all consume the same string.
2. **Three layouts instead of a bag of checkboxes.** `stage`, `technical`,
   `message` (§2). Picking a layout loads its default options; the
   checkboxes stay, under a collapsed "Customize" section, and edit those
   options. The layout decides the shape, the options decide the content.
3. **Special items are exported, in order.** Sections and breaks in every
   layout; note items when `notes` is on (same switch as song notes).
   Numbering counts songs only and runs continuously across sections, as
   today.
4. **Localised output, in the app's current language.** Every label goes
   through `t()`. Musical keys print as stored (`Dm`, `F#`), never
   translated. No per-export language picker (open question §9.1).
5. **Artist hoisting.** When every song has an artist and they are all equal,
   the artist is printed once in the header and never per song. Otherwise
   per song, as today. Applies to every layout when `artist` is on.
6. **Durations.** Songs in seconds, breaks in minutes × 60. `h:mm:ss` at or
   over an hour, `m:ss` below. When breaks with a duration exist, the header
   shows both "music" and "total" (`25:30 of music · 35:30 total`);
   otherwise one value. Songs without a duration count as 0; if **no** song
   has a duration the duration options are disabled, as today.
7. **Copy is the primary action.** Buttons: **Copy** (primary), **Download
   .txt**, **Share** (only when `navigator.share` exists). Share sends
   `{ title, text }`, not a file (file sharing support is uneven on iOS).
   Copy and Share do not close the modal; Download does, as today.
8. **Options persist per device**, not per setlist: localStorage
   `bandmate_setlist_export_options`, read with try/catch and validated
   field by field (unknown / missing fields fall back to the layout's
   default). Nothing else changes storage.
9. **Show info is opt-in and uses the first linked show**, the same one the
   "Linked to show" badge shows. The option is hidden when no show is
   linked.
10. **Missing songs are skipped**, as today (a song id with no `Song`, e.g.
    deleted): numbering stays continuous. No placeholder line.

## 2. Layouts

Sample data: Strato's six songs, with a made-up section and break to show
special items.

### 2.1 `stage` — to print or read from a tablet

Name upper-cased, sections upper-cased, song number right-aligned to the
widest number, nothing else by default.

```
STRATO

SET 1
 1  La Furia
 2  Karma
 3  Al Vacío
— Break · 10 min —
 4  Skirlaz
 5  A Las 10
 6  Mujer De Hielo
```

Defaults: `specialItems` on; every other option off. Song options that are
turned on print after the title, two spaces apart: ` 1  La Furia  Dm  195`.

### 2.2 `technical` — band / sound engineer

Monospace columns padded to the widest value per column. Columns appear only
for enabled options, in the order `#`, title, artist (unless hoisted), key,
BPM, duration, start. An empty cell prints `—`. A section prints its label
and its subtotal (songs + breaks up to the next section). A break is a full
row. Song notes go on the next line, indented under the title, prefixed with
`↳`.

```
Strato — Still Louder
6 songs · 25:30 of music · 35:30 total

 #  Song             Key  BPM  Dur.  Start
SET 1 · 35:30
 1  La Furia         Dm   195  3:33   0:00
 2  Karma            Em     —  4:30   3:33
 3  Al Vacío         Bm   220  4:06   8:03
    Break · 10 min                   12:09
 4  Skirlaz          Cm   163  4:06  22:09
 5  A Las 10         Cm   190  5:11  26:15
    ↳ Count-in by drums
 6  Mujer De Hielo   Gm     —  4:04  31:26
```

- **Start** is the cumulative time before the row, breaks included. After a
  song without a duration every later start is `—` (an unknown can't be
  summed past).
- Column width uses `[...str].length` on NFC-normalised text. East Asian
  wide characters and emoji may misalign; accepted.
- Titles are never truncated; a long title only widens its column.

Defaults: everything on, `start` on.

### 2.3 `message` — WhatsApp / chat

No columns (chat fonts are proportional). WhatsApp markup: `*bold*` for the
name and sections, `_italic_` for notes. Details in parentheses joined with
` · `.

```
*Strato* — Still Louder
6 songs · 25:30

*Set 1*
1. La Furia (Dm · 195)
2. Karma (Em)
3. Al Vacío (Bm · 220)
— Break · 10 min —
4. Skirlaz (Cm · 163)
5. A Las 10 (Cm · 190)
   _Count-in by drums_
6. Mujer De Hielo (Gm)
```

Defaults: `songCount`, `totalDuration`, `key`, `tempo`, `notes`, specials on;
`duration`, `start`, `description`, `show` off.

### 2.4 Header, all layouts

In order, each line only when its option is on and there is data:

1. Name (and hoisted artist): `Strato — Still Louder`.
2. Show: `{show name} · {date, locale long} · {time} · {venue}` (missing
   parts dropped).
3. Description.
4. `{n} songs · {duration}` (either half alone when only one option is on).

One blank line after the header, one before each section, none between
songs. The file ends with exactly one `\n`.

## 3. Contract

```ts
// src/utils/setlistText.ts
export type SetlistTextLayout = "stage" | "technical" | "message";

export interface SetlistTextOptions {
  layout: SetlistTextLayout;
  description: boolean;
  show: boolean;
  songCount: boolean;
  totalDuration: boolean;
  artist: boolean;
  key: boolean;
  tempo: boolean;
  duration: boolean;
  startTime: boolean; // technical only; ignored elsewhere
  notes: boolean;     // song notes and note items
  specialItems: boolean; // sections and breaks
}

export interface SetlistTextShow {
  name: string;
  event_date: string; // YYYY-MM-DD
  event_time?: string;
  venue?: string;
}

export interface SetlistTextInput {
  name: string;
  description?: string;
  items: SetlistItem[];
  songsById: ReadonlyMap<string, Song>;
  show?: SetlistTextShow;
}

export type Translate = (key: string, options?: Record<string, unknown>) => string;

export const SETLIST_TEXT_DEFAULTS: Record<SetlistTextLayout, SetlistTextOptions>;

export function formatSetlistText(
  input: SetlistTextInput,
  options: SetlistTextOptions,
  t: Translate,
  locale: string,
): string;

/** Seconds of music and seconds including breaks. */
export function setlistTextDurations(
  items: SetlistItem[],
  songsById: ReadonlyMap<string, Song>,
): { musicSeconds: number; totalSeconds: number };

/** "h:mm:ss" at or over an hour, else "m:ss". */
export function formatClock(seconds: number): string;

/** NFD, strip marks, lowercase, non-alphanumerics → "-", trimmed; "setlist" when empty. */
export function setlistFileName(name: string): string; // "al-vacio.txt"

/** Parse stored options; anything invalid falls back to the layout's defaults. */
export function parseStoredExportOptions(raw: string | null): SetlistTextOptions;
```

Storage and browser calls (localStorage, clipboard, `navigator.share`, the
download anchor) stay in the component or a small hook
(`useSetlistTextExport`), never in `setlistText.ts`.

## 4. UI (modal)

- Modal `size="lg"`. Top: a segmented control with the three layouts
  (label + one-line hint: "To print or read on stage", "Columns for the band
  and sound", "To paste in a chat").
- Below: preview in a `<pre>` (monospace, `white-space: pre`, horizontal
  scroll, max height ≈ 50 vh), updated on every change.
- "Customize" (collapsed by default): the checkboxes, grouped as today
  (Header / Songs). `show` only when a show is linked; `startTime` only for
  `technical`; duration options disabled with "(no durations)" as today.
- "Reset to layout defaults" link inside Customize.
- Footer: Cancel · Share (if supported) · Download .txt · **Copy**.
- Copy: `navigator.clipboard.writeText`; success swaps the icon to
  `bi-check-lg` and the label to "Copied" for 2 s (same pattern as
  `CalendarSubscriptionModal`); failure → `toast.error`.
- Share: `AbortError` (user closed the sheet) is ignored; other errors →
  `toast.error`.

All new copy in `en.json` and `es.json`, under `setlists.export.*`
(layouts, hints, actions) and `setlists.export.text.*` (strings that end up
in the output: song count with plural, music / total, break, column
headers). Section and break labels are user text and never translated. Follow the plural
convention of the existing `setlists.songCount`.

## 5. Permissions and offline

- Every role can export (read-only action), as today.
- Offline the export is unreachable (`SetlistDetailView` isn't mounted;
  `OfflineSetlistDetail` has no export). Adding it there is a follow-up that
  reuses `formatSetlistText` with the snapshot's rows; not in scope.
- No service, table, RLS or migration changes.

## 6. Acceptance criteria

1. A setlist with sections, breaks and note items exports them in order in
   every layout; song numbering skips them.
2. With the app in Spanish, no English label appears in the output (song
   titles, section labels and keys are user data and print as stored).
3. All songs by the same artist → the artist appears once, in the header.
   One song by another artist → per song, no header artist.
4. `technical`: columns align for the sample above; start times include
   break durations; after a song with no duration later starts are `—`.
5. Header shows "music · total" only when a break has a duration.
6. A 70-minute setlist prints `1:10:00`, not `70:00`.
7. "Al Vacío" downloads as `al-vacio.txt`; a name of only symbols as
   `setlist.txt`.
8. Copy puts exactly the preview text on the clipboard; pasted into
   WhatsApp, the `message` layout shows bold name and sections.
9. Share appears on iPad Safari / Android Chrome and not on desktop Firefox.
10. Closing and reopening the modal (and reloading) keeps the last layout
    and options; corrupt stored JSON falls back to defaults without error.
11. No `alert` / `confirm`; no console errors.

## 7. Tests

`src/utils/__tests__/setlistText.test.ts` (node, no DOM):

- each layout against a fixed fixture (inline snapshot), with the test
  i18next instance (`src/test/i18n.ts`) in `en` and one case in `es`;
- special items on/off; note items follow `notes`;
- artist hoisting: all equal / one different / one missing;
- durations: no durations, some missing, breaks with and without duration,
  ≥ 1 h;
- start column after a missing duration;
- skipped missing song keeps numbering continuous;
- `setlistFileName`: accents, symbols only, spaces, uppercase;
- `parseStoredExportOptions`: `null`, invalid JSON, unknown layout, missing
  field, wrong type.

Modal render test (`// @vitest-environment jsdom`) in PR 2: switching layout
updates the preview; Copy calls a stubbed `navigator.clipboard.writeText`
with the preview text; Share hidden without `navigator.share`.

## 8. PR breakdown

**PR 1 — formatter (logic, minimal UI change).**
- `src/utils/setlistText.ts` + tests (§3, §7) with all three layouts.
- `handleExportAsText` calls `formatSetlistText` with `layout: "technical"`
  mapped from the existing checkboxes (`startTime` off), and
  `setlistFileName`. Remove `formatDuration` / `calculateTotalDuration` /
  `getSetlistSongNotes` if nothing else uses them.
- Add the **Copy** button to the existing footer.
- i18n keys for the output strings.
- Fixes problems 1, 2, 4, 5, 6, 7, 9, 10 with today's modal.

**PR 2 — modal.**
- Layout picker, preview, Customize section, Share, show option, persisted
  options (`useSetlistTextExport`), modal render test.
- README **Features** (Setlists): "Export as text (stage, technical, chat)
  with copy and share".

Docs: add this spec to `docs/README.md`, the README Documentation list and
CLAUDE.md "External Documentation" (done with this spec); mark it
implemented when PR 2 merges.

## 9. Open questions

1. **Output language.** App language (decision 4) vs a picker in the modal,
   for a band whose sound engineer reads English. Recommend waiting for a
   real request.
2. **Several linked shows.** Decision 9 takes the first, like the badge. A
   picker is cheap if bands actually link one setlist to many shows.
3. **Export from the offline detail** (§5): worth it once offline ships
   without the flag.
4. **PDF / image of the `stage` layout.** Out of scope; `/setlists/:id/print`
   already covers printing, and the `stage` text is for chat or quick
   printing.
