# Spec: My upcoming events (cross-band agenda on the dashboard)

> **Status:** implemented, manual validation (AC6–AC9, AC12 on device) pending · **Created:** 2026-09-27 · **Owner:** Renán Díaz
> **Origin:** TODO "Poder ver una vista general de todas mis bandas, para ver
> mis próximos eventos (shows y rehearsals) de todas las bandas en las que
> estoy … que si le doy click a un show, me lleve a ese show dentro de la
> banda correspondiente, o los setlists".
> **Scope:** a personal agenda of the upcoming shows and rehearsals of every
> band the user belongs to, on the dashboard, with one-tap navigation into
> the right band. No songs, no setlists lists (those are per band). One
> phase, four PRs (§9). Do [app-header.md](app-header.md) first: this spec
> adds no navigation link on purpose.

This is a design, not code. Signatures are the contract; no bodies here.

## 0. Where we are

Everything in the app is scoped to `selectedBand` (`BandContext`): the
dashboard (`src/components/Home.tsx`) loads the selected band's songs,
setlists, upcoming shows and rehearsals, merges the last two into an inline
`UpcomingEvent` list (sorted by date, first four shown) and navigates to
`/shows/:id` or `/rehearsals/:id` on tap. `bands` (every membership, any
role, with `user_role`) is already in the context: the band switcher uses it.

What makes a cross-band view cheap:

| Fact | Where |
|------|-------|
| `getUpcomingShows(bandId)` / `getUpcomingRehearsals(bandId)` are one `.eq("band_id")` filter each | `showsService.ts`, `rehearsalsService.ts` |
| SELECT on `shows` and `rehearsals` is membership-based RLS, so a query over several band ids returns only what the user may see | baseline, "Band members can view shows/rehearsals" |
| Every event row carries `band_id` | `Show`, `Rehearsal` |
| A show carries `setlist_id`; a rehearsal carries `show_id` and `setlist_id` | same |
| Switching band is `setSelectedBand(band)` and nothing else | `BandSwitcher.handleSelectBand` |

What makes it delicate: the detail views (`ShowDetailView`,
`RehearsalDetailView`, `SetlistDetailView`) fetch by id but take the **role**
from `selectedBand.user_role` (`canManageEvents`, `canEditContent`). Opening
a show of band B while band A is selected renders B's show with A's
permissions and A's name in the header. The navigation must switch the band
first (§1 decision 3).

## 1. Decisions

1. **It lives on the dashboard, under the greeting and above the band
   section.** `/` for a user with **two or more** bands opens with
   "Welcome back!" as the page title, then "My upcoming events", then the
   band section headed by the band's name (PR 1.3: the greeting was below
   the agenda at first, and read as a lost title mid-page). With one band
   the greeting is followed by the band section directly: the band widget
   already is that user's agenda. No new route and no new nav link
   (the header spec just removed two). Tradeoff: the dashboard gets longer
   for multi-band users; the section is compact (two-line rows, ~60 px
   each), shows six events and expands on demand.
2. **Two queries, whatever the number of bands.**
   `getUpcomingShowsForBands(ids)` and `getUpcomingRehearsalsForBands(ids)`
   (`.in("band_id", ids)`), not one round-trip per band. The ids are the
   context's `bands`, so guests' bands are included (they can view events)
   and no membership query is repeated.
3. **Tapping an event selects its band, then navigates.** One hook,
   `useOpenInBand()`, does both in the same React batch, so the detail view
   mounts with the right `selectedBand` (permissions, header) on its first
   render. When the band actually changed an info toast says "Switched to
   {band}": the header, the band widget and every list silently changing
   underneath is the surprise we want to avoid, and one toast is the cheapest
   honest signal. Same band → no toast.
4. **The show's setlist is one tap away.** A show row with a `setlist_id`
   shows a "Setlist" chip that opens `/setlists/:id` in that band (same
   hook). A rehearsal row with a `show_id` shows a "Show" chip. No other
   cross-links: the TODO asks for events and their setlists, not a second
   band UI.
5. **One row component.** The band widget's event row is extracted into
   `UpcomingEventRow` and the new section renders the same row with a band
   label. The date, time and countdown formatting move with it; `Home.tsx`
   only loses code. The merge/sort logic becomes a pure util shared by
   both lists.
6. **Independent load, independent failure.** The section loads in its own
   effect keyed by the band ids, so a slow cross-band read never delays the
   band dashboard, and its failure renders an inline "Couldn't load your
   events" + Retry in the section: no toast (the band dashboard's own error
   handling stays the one that reports network failures to the context),
   never a hidden section.
7. **Online only.** `OfflineHome` is untouched and the section is not
   rendered offline; no snapshot holds events.

Not doing: a calendar grid (the band calendar already exists on `/shows`),
filters by band or type, past events, a per-band collapse, a "hide this
band" preference.

## 2. UX

Dashboard, signed in, `bands.length >= 2`:

```
Welcome back!

┌────────────────────────────────────────────────────────────────────┐
│ My upcoming events                                                 │
│ Shows and rehearsals from all your bands                           │
├────────────────────────────────────────────────────────────────────┤
│ FRI  The Cavern gig                                     [Setlist] │
│ 03   ● Los Rockers · Show · The Cavern · 9:00 PM · in 6 days      │
│ OCT                                                                │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
│ SUN  Pre-show run                                          [Show] │
│ 05   ● Jazz Trio · Rehearsal · Studio B · 6:00 PM · In 1 week     │
│ OCT                                                                │
├────────────────────────────────────────────────────────────────────┤
│                          Show all 11 ▾                             │
└────────────────────────────────────────────────────────────────────┘

👥 Los Rockers
[323 Songs] [12 Setlists] [2 Upcoming events]
…
```

- Sorted by date, then time (no time last), then band name. Six rows,
  then "Show all {n}" expands in place and "Show fewer" collapses; not
  remembered.
- **Two-line rows** (PR 1.3), flat, separated by dividers, not cards
  inside the card. The **date block** carries the weekday, the day and the
  month, so the meta line
  repeats no date. In this section its colour is the **band's**
  (`bandColorMap`, see the PR 1.4 changelog entry); in the band widget it
  stays purple for a show, cyan for a rehearsal. Line 1 is the name. Line 2 is one meta line, dot
  separated: the **band chip** (`BandAvatar` initial + name, muted) first,
  then the type ("Show" / "Rehearsal" with its icon, in the type's colour:
  the word stays for colour-blind users), the venue/location, the time and
  the **countdown**. Rows of the selected band show the chip too: the list
  is "mine", not "the others'", and a chip that appears only sometimes
  reads as a bug.
- **The countdown is plain text**, amber and medium weight only up to
  `SOON_DAYS` (7) days away ("Today", "Tomorrow", "In 3 days"); later ones
  stay in the meta line's grey. A badge on every row made the colour mean
  nothing.
- The **Setlist / Show chip** is the row's only right-hand element,
  vertically centred.
- The header stacks the title and the hint as a subtitle; nothing competes
  for the width.
- The band widget below renders the same two-line row without the band
  chip (decision 5: one row component).
- Tap the row → its event, in its band (decision 3). Tap "Setlist" /
  "Show" → that page, in its band; the tap does not bubble to the row.
- Empty: "No upcoming events in any of your bands" (no action button: which
  band would it schedule in?).
- Loading: the section's own skeleton line, the band dashboard unaffected.
- Error: inline line + Retry (`common.retry`).
- Toast on band change: `toast.info(t("home.switchedToBand", { band }))`.
- The "Upcoming events" stat card and widget below stay band-scoped and
  unchanged; duplication of the selected band's events between the two is
  intended (different scope, labelled).
- One band: the section is not rendered at all, not even its heading.
- Offline (`useOfflineUi()`): `OfflineHome` as today; the section is online
  only.

## 3. Contract

### 3.1 Services

```ts
// src/services/showsService.ts
/** Upcoming shows of several bands in one query; [] for no ids. Same filters as getUpcomingShows. */
export async function getUpcomingShowsForBands(bandIds: number[]): Promise<Show[]>;

// src/services/rehearsalsService.ts
export async function getUpcomingRehearsalsForBands(bandIds: number[]): Promise<Rehearsal[]>;
```

Both: `status` filter and `gte(date, getLocalToday())` exactly as the
single-band versions, `order(date)`, `[]` without a round-trip when `bandIds`
is empty. The single-band functions stay (the band dashboard and `/shows`
keep using them); implementing them as `ForBands([id])` is fine.

### 3.2 Pure util

```ts
// src/utils/upcomingEvents.ts (plain TS, no React)
export type UpcomingEvent =
  | { type: "show"; id: string; bandId: number; date: string; time?: string; data: Show }
  | { type: "rehearsal"; id: string; bandId: number; date: string; time?: string; data: Rehearsal };

/** Merge and sort by date, then time (missing time last), then band name, then name. */
export function mergeUpcomingEvents(
  shows: Show[],
  rehearsals: Rehearsal[],
  bandNameById?: ReadonlyMap<number, string>
): UpcomingEvent[];

/** Route of the event itself. */
export function eventPath(event: UpcomingEvent): string;          // "/shows/:id" | "/rehearsals/:id"
/** The secondary link, when the row has one. */
export function eventLink(event: UpcomingEvent): { labelKey: "home.setlist" | "home.show"; path: string } | null;
```

`Home.tsx` replaces its inline type and sort with `mergeUpcomingEvents(shows,
rehearsals)` (no map: one band). Home sorted by date only before; it now
breaks same-date ties by time (see Changelog).

### 3.3 Hook

```ts
// src/hooks/useOpenInBand.ts
/**
 * Navigate to a band-scoped page, selecting that band first when it is not
 * the current one (the detail views take role and header from selectedBand).
 * Unknown bandId (not in `bands`): navigates anyway without switching — the
 * page will fail its own load; the hook never throws.
 */
export function useOpenInBand(): (bandId: number, path: string) => void;
```

Reads `bands`, `selectedBand`, `setSelectedBand` from `useBandContext()`,
`useNavigate()` and `useToast()`. Order inside the handler:
`setSelectedBand(band)` (only if `band.id !== selectedBand?.id`), then
`navigate(path)`, then the toast (only when switched). `BandStorage` is
written by the context's existing effect; the hook does not touch storage.

### 3.4 Components

```ts
// src/components/home/UpcomingEventRow.tsx  (extracted from Home.tsx)
interface UpcomingEventRowProps {
  event: UpcomingEvent;
  locale: string;                  // "es-ES" | "en-US", as Home computes it
  bandName?: string;               // renders the band chip when given
  bandAvatarUrl?: string | null;
  onOpen: () => void;
  onOpenLink?: () => void;         // the Setlist / Show chip; omitted → no chip
}
/** Countdowns up to this many days away are emphasised (amber); later ones are plain. */
export const SOON_DAYS = 7;

// src/components/home/MyUpcomingEvents.tsx
/** Renders nothing with fewer than two bands. Loads its own data. */
export const MyUpcomingEvents: FC;
```

`MyUpcomingEvents` uses `bands` from the context; the effect depends on the
sorted id list (a stable string key), not the `bands` array identity, so a
`refreshBands()` that returns the same bands does not refetch. Collapsed
count `VISIBLE_EVENTS = 6` is a named constant.

`Home.tsx`: one `Container` inside `DashboardSection`: `PendingInvitations`,
`SchemaWipeNotice`, the `WelcomeTitle` (`h1`), `<MyUpcomingEvents />`, then
`BandHeading` (`h2`, the band's name) and the band-scoped stats, widgets
and quick actions; the band widget's rows are `UpcomingEventRow` without
`bandName`.

### 3.5 i18n (both locales)

```
home.myUpcomingEvents        My upcoming events
home.myUpcomingEventsHint    Shows and rehearsals from all your bands
home.noMyUpcomingEvents      No upcoming events in any of your bands
home.myEventsLoadError       Couldn't load your events
home.showAllEvents           Show all {{count}}
home.showFewerEvents         Show fewer
home.switchedToBand          Switched to {{band}}
home.setlist                 Setlist
```

`home.show` / `home.rehearsal` already exist and label the chips and badges
(`shows.setlist` exists too, but the dashboard keeps its own keys).

## 4. Acceptance criteria

`[unit]` Vitest, `[UI]` dev server with a user in three bands (one as guest).

- AC1 `[unit]` `mergeUpcomingEvents`: shows and rehearsals interleave by
  date; same date orders by time with no-time last; same date and time by
  band name; `eventPath` and `eventLink` (show with/without `setlist_id`,
  rehearsal with/without `show_id`).
- AC2 `[unit]` Services: `getUpcomingShowsForBands([])` resolves `[]`
  without calling Supabase; with ids it filters `in("band_id")`, `status`
  and today (mocked client, same style as the existing service tests).
- AC3 `[unit]` `useOpenInBand` (jsdom, `renderApp`): same band → no
  `setSelectedBand`, location changes, no toast; other band →
  `setSelectedBand(thatBand)` then the location changes and one info toast
  names the band; unknown id → navigates, no switch, no toast.
- AC4 `[unit]` `MyUpcomingEvents`: one band → renders nothing; two bands →
  rows carry the band names, the seventh event is hidden until "Show all
  {n}", a rejected read renders the error line and Retry refetches; a show
  row with `setlist_id` renders the Setlist chip and its click does not
  trigger the row's `onOpen`.
- AC5 `[unit]` The existing `HomeOffline` tests pass unchanged: the band
  widget renders the same rows through `UpcomingEventRow`.
- AC6 `[UI]` Three bands: the section lists every upcoming show and
  rehearsal of the three, sorted, with band chips; tapping a show of a
  non-selected band opens it, the header shows that band, the toast names
  it, and Edit/Delete follow that band's role (guest band → no manage
  actions). Reload: the switched band is still selected.
- AC7 `[UI]` "Setlist" on a show row opens the setlist detail in that band;
  "Show" on a rehearsal row opens the show. Back returns to `/` with the
  new band selected (expected; documented in the toast).
- AC8 `[UI]` One band: the dashboard is pixel-identical to before. Offline
  (flag on): `OfflineHome` as before.
- AC9 `[UI]` Airplane mode after the dashboard loaded, then Retry in the
  section: the error line shows and no toast is added by the section.
- AC10 `npm run lint`, `npm run build`, `npm test` pass; new strings in both
  locales.
- AC11 `[unit]` `UpcomingEventRow` (PR 1.3): the date block shows weekday,
  day and month and the meta line no date; the meta line reads band, type,
  place, time, countdown in that order; a countdown within `SOON_DAYS` is
  marked soon and a later one is not; without `bandName` no chip.
- AC12 `[UI]` (PR 1.3) Two bands, desktop and phone: the greeting is the
  first thing on the page, six events of the agenda fit in about half a
  laptop viewport, the band's name heads the stats, long names truncate
  with an ellipsis and the meta line wraps on the phone without pushing
  the chip out of the row.

## 5. Tests

- `src/utils/__tests__/upcomingEvents.test.ts` — AC1.
- `src/services/__tests__/eventsForBands.test.ts` — AC2 (mock
  `src/lib/supabaseClient` as `setup.ts` does; assert the builder calls).
- `src/hooks/__tests__/useOpenInBand.test.tsx` — AC3 (jsdom; `renderApp`
  with `bands: [A, B]`, `selectedBand: A`; the toast is asserted through the
  rendered `ToastProvider`).
- `src/components/__tests__/MyUpcomingEvents.test.tsx` — AC4 (jsdom;
  services mocked at the module boundary like `HomeOffline.test.tsx`).
- `src/components/home/__tests__/UpcomingEventRow.test.tsx` — AC11
  (`renderToStaticMarkup` with the test i18next instance).
- Manual: AC6–AC9 and AC12 in the PR description, with the roles used.

## 6. Risks

- **Band switch as a side effect of a tap.** A user who taps a show of
  band B and then goes to `/songs` is in B's library. This is the correct
  reading of "me lleve a ese show dentro de la banda correspondiente", and
  the toast makes it visible; the alternative (render B's show under A
  without switching) breaks permissions and the header. If it proves
  annoying, the follow-up is "return to the previous band on Back", not
  removing the switch.
- **`setSelectedBand` + `navigate` in one batch.** React 19 batches both
  updates from an event handler, so the detail view first renders with B.
  AC3 asserts the order; AC6 asserts the visible result. Don't move the
  navigate into an effect "to be safe": that adds a frame of A's header.
- **Two more queries on every dashboard load** for multi-band users, in
  parallel with the four existing ones. Acceptable; if it ever matters, a
  30 s in-memory cache keyed by the id list is the fix, not a merge into
  the band dashboard's `Promise.all`.
- **Time zone.** Dates are stored as local calendar dates with no zone
  (`CLAUDE.md`, Edge Functions: iCal times are floating); a band in another time zone shows its local date, which
  is what the band itself sees. Out of scope to change.
- **The extraction of the row from `Home.tsx`.** Same rule as the header
  spec: a pure-move commit, then the feature commit.

## 7. Out of scope

A dedicated `/agenda` route; past events; filters; a cross-band calendar
grid; iCal for all bands (each band has its own feed); notifications;
restoring the previous band on Back; songs or setlists across bands.

## 8. Files touched (expected)

```
src/services/showsService.ts                          getUpcomingShowsForBands
src/services/rehearsalsService.ts                     getUpcomingRehearsalsForBands
src/utils/upcomingEvents.ts                           new: type, merge/sort, paths
src/hooks/useOpenInBand.ts                            new
src/components/home/UpcomingEventRow.tsx              new (moved from Home.tsx)
src/components/home/MyUpcomingEvents.tsx              new
src/components/Home.tsx                               uses the util and the row; renders the section
src/i18n/locales/en.json, es.json                     §3.5
tests per §5
CLAUDE.md                                             services table (the two functions), hooks list, utils list, Route "/" line
README.md                                             Features → Shows & rehearsals: "Personal agenda across your bands on the dashboard"
```

## 9. Phases and PRs

### Phase 1 — my upcoming events on the dashboard

**Goal:** a multi-band user opens `/` and sees every upcoming show and
rehearsal across their bands, and one tap lands in the right band with the
right permissions; single-band users see no change.
**Closes:** AC1–AC10. **Validate (manual):** AC6–AC9 with a three-band user
(one guest membership), desktop and phone; record the roles and devices.

- **PR 1.1 — data and navigation, no visible change.** §3.1–§3.3, the
  extraction of `UpcomingEventRow` and of the merge into
  `src/utils/upcomingEvents.ts` (Home renders identically; AC5 proves it),
  tests AC1–AC3, AC5.
- **PR 1.2 — the section.** §3.4 `MyUpcomingEvents`, §3.5, tests AC4, the
  manual checklist AC6–AC9, docs.
- **PR 1.3 — compact agenda, greeting first.** The two-line row, the
  countdown emphasis rule and the header layout of §2; `Home.tsx` reordered
  (greeting, agenda, band heading, band section); tests AC11; the manual
  check AC12. No data or navigation change.
- **PR 1.4 — band colours.** The section's date block in the band's colour
  (`bandColorMap`); tests in `bandColors.test.ts`, AC11 and AC4. No data
  or navigation change.

Definition of done per PR: the `CLAUDE.md` checklist. The phase is done
when PR 1.4 merges with the manual checklists recorded in the PR
descriptions.

## Changelog

- **PR 1.1 (data and navigation).** Implemented §3.1–§3.3 and the
  `UpcomingEventRow` extraction (pure-move commit first). Corrections to the
  draft:
  1. **Field names.** Shows filter `status = "upcoming"` on `event_date`
     (time `event_time`); rehearsals `status = "scheduled"` on
     `rehearsal_date` (time `start_time`). The `ForBands` functions use the
     single-band filters and ordering column with `.in("band_id", ids)`;
     `UpcomingEvent.date` / `.time` are normalized from those fields inside
     `mergeUpcomingEvents`.
  2. **Label keys.** `eventLink` returns `"home.setlist"` (there is no
     `common.setlist`) or `"home.show"`. `home.setlist` is added in PR 1.2,
     where the chip is first rendered.
  3. **Ordering.** Home sorted by date only; through `mergeUpcomingEvents` it
     now orders same-date events by time (no time last). Date strings
     (`YYYY-MM-DD`) are compared directly, not parsed with `new Date()`
     (UTC). The one visible change of PR 1.1.

  `home.switchedToBand` landed in PR 1.1 (the hook needs it); the other §3.5
  keys land in PR 1.2.

- **PR 1.2 (the section).** Implemented §3.4 (`MyUpcomingEvents`) and §3.5,
  tests AC4. Additions to the contract:
  1. **Band chip avatar.** `UpcomingEventRowProps` gains `bandAvatarUrl?`,
     and `BandAvatar` an opt-in `initialFallback` prop: without an avatar the
     18 px chip shows the band's initial instead of the music-note icon (the
     icon would look the same for every band). Default rendering unchanged.
  2. **No `reportNetworkFailure()` from the section**, success or failure
     (decision 6): the band dashboard stays the only reporter. Retry refetches
     only the section.
  3. **Stale responses.** The effect keys on the sorted id string plus a retry
     counter; its cleanup drops a response for an older key.

- **PR 1.3 (compact agenda, greeting first).** PR 1.2 rendered four-line
  card rows (type badge line, name, place, meta line with a countdown
  badge) inside the section card, above "Welcome back!": four events
  filled a laptop viewport, the greeting read as a lost title mid-page, the
  band (the point of the list) was the smallest text in the row, and the
  amber countdown on every row meant nothing. Changes:
  1. **Row** as in §2: date block with weekday/day/month, name, one meta
     line (band · type · place · time · countdown), the link chip centred
     on the right; `SOON_DAYS` exported for the emphasis rule. Flat rows
     with dividers in the section. The band widget renders the same row,
     so AC8's "pixel-identical" held only until this PR: the single-band
     dashboard now has the greeting, the band heading and the compact
     widget rows.
  2. **`Home.tsx`**: one `Container`; `WelcomeTitle` first, then the agenda,
     then `BandHeading` (the band's name, `h2`) before the stats. The
     `DashboardHeader` / `WelcomeText` / `BandNameText` wrappers are gone.
  3. **Header**: title and hint stacked.
  Not done here, on purpose: a band filter in the agenda replacing the band
  widget for multi-band users. The duplication between the agenda and the
  widget (decision 1, "Not doing") stays; it is the next thing to revisit
  if the dashboard still feels long.

- **PR 1.4 (band colours).** With several bands the rows only differed by
  the small band chip. The date block now takes one colour per band from
  `BAND_COLORS` (`src/utils/bandColors.ts`: eight entries, the brand
  gradient first, the rest dark enough for white text), assigned by
  `bandColorMap(ids)`: the band's position among the user's band ids
  sorted ascending. Distinct up to eight bands, then it wraps; the same
  set of bands always gets the same colours, but joining or leaving a band
  with a lower id shifts the ones after it (accepted: no schema change,
  nothing to configure). Show vs rehearsal stays readable from the type
  word, its icon and its colour on the meta line. The single-band widget
  passes no `bandColor` and is unchanged. Not done: a colour the band
  chooses (a `bands.color` column in settings), the next step if the
  automatic one is not enough.
