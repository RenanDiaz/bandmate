# Spec: Setlist actions layout (detail header + list cards)

> **Status:** PR 1 (detail header) implemented; PR 2 (list cards) pending · **Created:** 2026-09-27 · **Owner:** Renán Díaz
> **Origin:** the setlist detail header has nine action buttons in one row,
> and the setlist list hides its actions until the mouse hovers. Both were
> reviewed against phone / tablet / desktop and touch / mouse / keyboard.
> **Scope:** re-distribute the actions of `SetlistDetailView` and
> `SetlistList` by priority and context. No new features, no service, table
> or migration changes. Two PRs (§9).

This is a design, not code. Component names and props are the contract; no
bodies here.

## 0. Where we are

### 0.1 Setlist detail (`SetlistDetailView.tsx`)

`HeaderTop` renders the back link on the left and `ActionButtons` on the
right, **above the title**. Outside reorder mode the bar holds, in order:

| # | Action | Who sees it today | Should see it | Condition | Goes to |
|---|--------|-------------------|---------------|-----------|---------|
| 1 | Reorder | everyone | editors | ≥ 2 songs | in-place reorder mode |
| 2 | Rename Setlist | everyone | editors | — | `EditSetlistModal` (name, description) |
| 3 | Edit Setlist | everyone | editors | — | `/setlists/:id/edit` |
| 4 | Print | everyone | everyone | ≥ 1 item | `/setlists/:id/print` |
| 5 | Export | everyone | everyone | ≥ 1 song | `SetlistTextExportModal` |
| 6 | YouTube | everyone | everyone | ≥ 1 song | YouTube playlist modal |
| 7 | Propose | everyone | everyone | — | `NewRequestModal` (setlist proposal) |
| 8 | Make available offline | everyone (flag) | everyone | flag on | download flow (`OfflineDownloadAction`, variant `setlist`) |
| 9 | Start Performance | everyone | everyone | ≥ 1 item | `/setlists/:id/perform` |

Plus **Link to show** in the `MetadataBar` under the description (visible to
everyone; a show write, so guests fail at RLS).

In reorder mode the bar becomes Cancel · Optimize order (AI) · Save order,
and a `ReorderBanner` with the hint appears above the list.

Problems, by impact:

| # | Problem | Where |
|---|---------|-------|
| 1 | **Nine peers, one colour.** Eight brand-purple buttons and one green one; the primary action (Perform) is last and gets no more weight than YouTube | `ActionButtons` |
| 2 | **On a phone the buttons come before the name.** Below `md` every button is `min-width: 50%`, so the user scrolls past four or five rows of buttons before reading which setlist this is | `HeaderTop` column layout |
| 3 | **Icon-only on tablets with no label anywhere.** Between `md` and `xl` the labels are hidden and only `title` remains, which touch devices never show. On an iPad the header is eight unlabeled purple icons | `$iconOnly` media query |
| 4 | **Editing actions are shown to guests.** Reorder, Rename, Edit Setlist and Link to show are not gated by `canEditContent` / `canManageEvents`; a guest gets the "no permission" toast after the fact. The content-permissions spec left this view "unchanged" and only gated the per-song Edit | `ActionButtons`, `MetadataBar` |
| 5 | **Reorder's Save is far from the list.** After dragging the 25th song the Save button is at the top of the page | `ActionButtons` in reorder mode |
| 6 | The offline state is split: the action lives in the header, the badge / Remove / interrupted notice live in `OfflineStatusRow` under the title | `OfflineDownloadAction`, `OfflineStatusRow` |

Not a problem: the actions themselves. Every one of them has a use; the
issue is that they are all presented as equals.

### 0.2 Setlist list (`SetlistList.tsx`)

Each card is clickable (→ detail) and carries **two implementations of the
same three actions**: inline icon buttons (Perform, Edit, Delete) for
desktop and a `⋯` dropdown for `< md`. The inline buttons are `opacity: 0`
until the card is hovered, except on `(hover: none)` devices ≥ `md`.

| # | Problem | Where |
|---|---------|-------|
| 1 | **Invisible until hover.** A mouse user has no cue that a card has actions. A keyboard user tabs into buttons they cannot see (`opacity: 0` is still focusable; there is no `:focus-within` rule) | `ActionButtons` |
| 2 | **Perform is the primary action of the app and is a 36 px ghost icon**, or two taps away on a phone (`⋯` → Perform) | `ActionButton $variant="perform"` |
| 3 | **Two code paths for one menu.** Handlers and `stopPropagation` are duplicated; `ShowList` and `RequestList` copy the same pattern, so a fix has to land four times | inline + `MobileDropdownWrapper` |
| 4 | Card click is a `div` `onClick`: no keyboard activation, no middle-click / long-press "open in new tab" | `SetlistCard` |
| 5 | 36 px targets are under the style guide's 40 px minimum for icon buttons | `ActionButton` |

`canEdit` is already respected (guests only see Perform).

## 1. Decisions

1. **Three tiers in the detail header, by frequency and weight.**
   *Primary*: Perform, the only filled button. *Secondary*: Edit setlist
   (editors), outlined. *Everything else* behind one `⋯` "More actions"
   menu, grouped with dividers. Nothing is removed.
2. **The title comes first, on every screen.** The header row is
   `title | actions` from `md` up and `title` then `actions` below it on
   phones. The back link stays above the header card as today.
3. **Labels at every size on the visible buttons.** Perform always has its
   label. Edit keeps its label down to `sm`; below `sm` it is icon-only with
   `aria-label`. The `⋯` button is icon-only everywhere, 40 × 40, with
   `aria-label`. Menu items always show icon + label, so touch users never
   depend on `title`.
4. **Actions live next to what they act on.** The reorder controls
   (Cancel · Optimize · Save) move from the header to a **mode toolbar above
   the list**, replacing `ReorderBanner`, sticky under the navbar so Save is
   always within reach. The offline action moves into `OfflineStatusRow`,
   which becomes the single line that owns this setlist's offline state.
   "Link to show" stays in the metadata bar next to "Linked to show".
5. **Role gating fixed while we are there.** Reorder, Rename and Edit
   setlist require `canEditContent`; Link to show requires
   `canManageEvents`. Guests see Perform and the `⋯` with the read-only
   items (Print, Export, YouTube, Propose). Same helpers as the rest of the
   app; no bare `!== "guest"`.
6. **One implementation of the card actions in the list, for every size and
   input.** `[▶ Perform] [⋯]` on the right of the card name. Perform is
   always visible (outlined success, label from `sm` up, 40 × 40 icon below).
   `⋯` (editors only) holds Edit and Delete. The hover-reveal and the
   duplicated inline / dropdown pair go away.
   *Tradeoff:* a mouse user needs two clicks for Edit or Delete instead of
   one hover + click. Accepted: the frequent actions from the list are open
   (one click on the card) and Perform (one click); Delete should never be
   one click from a list. The alternative, inline icons under
   `@media (hover: hover)` plus a `:focus-within` fix, keeps two code paths
   for the sake of one click and was rejected.
7. **The card name is a real link.** `SetlistName` renders a `<Link>` to the
   detail (keyboard, middle-click, long-press work); the card `onClick`
   stays for pointer users clicking the padding. Buttons inside the card
   keep `stopPropagation`.
8. **Reuse the reactstrap `Dropdown`** already used by the lists
   (`DropdownMenu end dark container="body"`), with items at a 44 px minimum
   height. No new dependency, no custom popover.
9. **Same visual language as today's design tokens.** Filled success for
   Perform, outlined (`var(--color-border)`, brand border on hover) for Edit
   and `⋯`, `theme.radius.base`, `theme.space[2]` gaps. Touch targets: 44 px
   for labelled buttons, 40 × 40 for icon buttons (style guide "Touch
   Targets").

## 2. Setlist detail header

### 2.1 Layout

From `md` up:

```
← Back to setlists

┌──────────────────────────────────────────────────────────────────────┐
│ Summer Tour 2026                          [▶ Perform] [✎ Edit] [ ⋯ ] │
│ ☁ Available offline · saved 2 days ago · Remove                       │
│ Opening set for the July dates.                                      │
│ [♪ 12 songs] [⏱ Total 48:20] [📅 Linked to show: Jazz Fest]           │
└──────────────────────────────────────────────────────────────────────┘
```

Below `md`:

```
← Back to setlists

┌──────────────────────────────────┐
│ Summer Tour 2026                 │
│ ☁ Make available offline         │
│ [▶ Perform         ] [✎] [ ⋯ ]  │
│ Opening set for the July dates.  │
│ [♪ 12 songs] [⏱ Total 48:20]     │
│ [🔗 Link to show]                │
└──────────────────────────────────┘
```

- `HeaderTop` becomes `HeaderRow`: `display: flex; align-items: flex-start;
  justify-content: space-between; gap: space[4]`; the title has `min-width:
  0` and wraps; the actions group has `flex-shrink: 0`. Below `md`:
  `flex-direction: column`, and the actions group is `display: flex; width:
  100%` with Perform `flex: 1`.
- The title moves out of its own row into `HeaderRow`; `OfflineStatusRow`,
  description and `MetadataBar` follow as today.

### 2.2 Buttons

| Button | Style | Visible to | Disabled when | Label |
|--------|-------|-----------|---------------|-------|
| Perform | filled success (as today's `$variant="perform"`) | everyone | no items | `setlists.detail.startPerformance`, always shown |
| Edit | outlined secondary | `canEditContent` | — | `setlists.editSetlist`; icon-only below `sm` (`aria-label`) |
| ⋯ | outlined icon button 40 × 40 | everyone | — | `aria-label={t("common.moreActions")}`, `aria-haspopup="menu"` |

### 2.3 The `⋯` menu

Order and dividers. An item that doesn't apply is **hidden** by role and
**disabled** by state (so the user learns it exists).

```
Reorder songs            editors · disabled < 2 songs
Rename / description     editors
──────────────
Print                    disabled with no items
Export as text           disabled with no songs
YouTube playlist         disabled with no songs
──────────────
Propose changes
```

- Reorder enters the in-place reorder mode (unchanged behaviour).
- "Rename / description" opens `EditSetlistModal`; key
  `setlists.renameSetlist` as today.
- Menu closes on selection, `Escape` and outside click (reactstrap).
- With every editor item hidden (guest) the first divider is not rendered.

### 2.4 Reorder mode toolbar

The header actions are disabled while reordering (not swapped out: the
header stays stable). Above the list, replacing `ReorderBanner`:

```
┌──────────────────────────────────────────────────────────────────────┐
│ ℹ Drag songs to reorder      [Cancel] [✨ Optimize order] [✓ Save order] │
└──────────────────────────────────────────────────────────────────────┘
```

- `position: sticky; top: <navbar height>; z-index` above the cards, same
  background as the banner today, so Save is reachable from anywhere in the
  list.
- Optimize keeps its condition (`groqService.isConfigured()` and ≥ 3 songs).
- Below `md` the hint goes on its own line and the three buttons share a
  row: Cancel and Optimize outlined, Save filled and `flex: 1`.
- `saving` / `optimizing` disable the three buttons as today.

### 2.5 Offline row

`OfflineStatusRow` becomes the only place for the offline state of the
setlist (flag on). One line under the title, always rendered when the flag
is on:

| State | Renders |
|-------|---------|
| no snapshot, online + `session` | `☁ Make available offline` link-button (opens the same flow) |
| no snapshot, otherwise | `☁ Needs a connection`, disabled |
| downloading | `⟳ Downloading 3/10…` link-button (opens the progress modal) |
| saved | badge + Remove, as today |
| partial | badge (partial) + `Retry` + Remove |
| interrupted | notice with Resume / Discard, as today |

Implementation: `OfflineDownloadAction`'s `setlist` variant renders in the
row's link style (`LinkButton`) instead of a header button, and
`SetlistDetailView` stops rendering it in the header. The `show` and
`toolbar` variants are unchanged. The offline spec's §4.1 placement note and
CLAUDE.md's "Offline download UI" paragraph are updated in the same PR.

### 2.6 Metadata bar

Unchanged, except **Link to show** renders only with `canManageEvents`. The
"Linked to show" badge stays for everyone.

## 3. Setlist list cards

```
┌────────────────────────────────────────────────────────┐
│ [♪] Summer Tour 2026                  [▶ Perform] [ ⋯ ] │
│     [♪ 12 songs] [☁ Available offline]                 │
│ ────────────────────────────────────────────────────── │
│ Opening set for the July dates.                        │
└────────────────────────────────────────────────────────┘
```

- **Perform**: outlined success, label `setlists.perform` from `sm` up,
  icon-only 40 × 40 below `sm` with `aria-label`. Always visible, no hover
  dependency. Disabled with 0 songs.
- **⋯** (only when `canEdit`): `common.moreActions`; items `Edit`
  (`/setlists/:id/edit`), divider, `Delete` (`text-danger`, opens the
  existing `ConfirmModal` through `onDelete`).
- Remove `ActionButtons` (hover-reveal), `MobileDropdownWrapper` and their
  media queries. One `CardActions` block, `flex-shrink: 0`,
  `align-self: flex-start`.
- `SetlistName` is a `<Link to={`/setlists/${id}`}>` styled as today
  (`color: inherit; text-decoration: none`); the card `onClick` remains.
- The grid is unchanged (`minmax(380px, 1fr)`, one column below `md`).

Shows and requests keep their current pattern; extracting a shared
`CardActionMenu` for the four lists is a follow-up (§10).

## 4. Input modes

| | Touch (phone, iPad) | Mouse | Keyboard |
|---|---|---|---|
| Discoverability | every action visible or behind a visible `⋯`; no hover, no `title`-only affordance | same; hover only adds the lift/border feedback | every control focusable in DOM order; nothing focusable is invisible |
| Target size | ≥ 44 px labelled buttons, ≥ 40 px icon buttons, ≥ 44 px menu items | same sizes (no separate compact mode) | — |
| Labels | on the button or in the menu | plus `title` tooltips on icon-only buttons | `aria-label` on icon-only buttons and on `⋯` |
| Menu | opens on tap, closes on item, outside tap or scroll | opens on click, closes on item, outside click or `Escape` | `Enter`/`Space` opens, arrows move, `Escape` closes (reactstrap) |
| Card | tap opens the detail; buttons stop propagation | same | `Tab` to the name link, `Enter` opens |

## 5. Contract

```ts
// src/components/setlist/SetlistHeaderActions.tsx (presentational, no services)
export interface SetlistHeaderActionsProps {
  canEdit: boolean;            // canEditContent(role)
  itemCount: number;           // songs + special items
  songCount: number;
  reorderMode: boolean;        // disables everything while reordering
  onPerform(): void;
  onEdit(): void;
  onReorder(): void;
  onRename(): void;
  onPrint(): void;
  onExport(): void;
  onYouTube(): void;
  onPropose(): void;
}
export const SetlistHeaderActions: FC<SetlistHeaderActionsProps>;

// src/components/setlist/ReorderToolbar.tsx (presentational)
export interface ReorderToolbarProps {
  canOptimize: boolean;
  saving: boolean;
  optimizing: boolean;
  onCancel(): void;
  onOptimize(): void;
  onSave(): void;
}
export const ReorderToolbar: FC<ReorderToolbarProps>;
```

`SetlistDetailView` keeps its state and handlers and renders these two
instead of the inline bar. `SetlistList` keeps its props (`setlists`,
`onDelete`, `canEdit`); only `SetlistCardItem`'s markup changes.

New i18n keys, both locales: `common.moreActions` ("More actions" / "Más
acciones"). The menu keeps the existing `setlists.renameSetlist` label for
the name / description modal. Every other label already exists
(`setlists.detail.reorder`, `setlists.editSetlist`, `setlists.print`,
`setlists.export.button`, `youtubeMusic.exportToYouTube`,
`requests.proposeSetlist`, `setlists.detail.startPerformance`,
`setlists.perform`, `common.edit`, `common.delete`, `offline.action.*`).

## 6. Permissions and offline

- No service, RLS or migration changes. The UI now hides what the services
  already refuse (`PermissionError` → `common.noPermission` stays as the
  safety net).
- Offline the detail route renders `OfflineSetlistDetail`, not this view;
  nothing here changes offline behaviour. The download flow, controller and
  store are untouched; only where the `setlist` variant's button is rendered
  moves.

## 7. Acceptance criteria

Detail header:

1. Outside reorder mode the header shows exactly three controls for an
   editor (Perform, Edit, ⋯) and two for a guest (Perform, ⋯), at every
   width from 360 px to 1400 px.
2. On a 375 px-wide phone the setlist name is the first thing in the header
   card; the actions row is below it and needs no horizontal scroll.
3. On an iPad (touch, ≥ `md`) every visible action shows its label or is
   the `⋯` button; opening `⋯` shows icon + label for every item.
4. A guest never sees Reorder, Rename, Edit or Link to show; a member sees
   all of them. Both roles see Print, Export, YouTube and Propose.
5. Reorder is disabled with fewer than 2 songs; Print with no items; Export
   and YouTube with no songs.
6. Entering reorder mode shows the sticky toolbar above the list; after
   scrolling to the last song, Save is still on screen. Cancel restores the
   order; Save persists it and leaves the mode. The header buttons are
   disabled meanwhile.
7. With the offline flag on, the row under the title shows "Make available
   offline" when no copy exists, the progress while downloading, and the
   badge + Remove once saved. The header has no offline button.
8. Keyboard only: `Tab` reaches Perform, Edit, ⋯ in that order; `Enter` on
   ⋯ opens the menu; arrows move; `Escape` closes and returns focus to ⋯.

List:

9. Perform is visible on every card without hovering, on desktop, iPad and
   phone; 40 × 40 minimum.
10. ⋯ appears only when `canEdit`; it contains Edit and Delete; Delete opens
    the confirm modal, and cancelling it leaves the list unchanged.
11. Clicking the card body opens the detail; clicking Perform or ⋯ does not.
    Middle-clicking the name opens the detail in a new tab.
12. Tabbing through the list never focuses an invisible control.
13. `npm run lint`, `npm run build`, `npm test` pass; no `alert`/`confirm`;
    no console errors in the dev server on the flows above.

## 8. Tests

- `src/components/setlist/__tests__/SetlistHeaderActions.test.tsx`
  (`// @vitest-environment jsdom`, test i18next): editor vs guest control
  set; disabled states from counts; menu item order and dividers; callbacks
  fire; `reorderMode` disables the three controls; `aria-label` on ⋯.
- `src/components/setlist/__tests__/ReorderToolbar.test.tsx`
  (`renderToStaticMarkup`): Optimize hidden when `canOptimize` is false;
  `saving` shows the spinner label and disables all three.
- `src/components/__tests__/SetlistList.test.tsx` (jsdom, mocks
  `useOfflineSnapshotMetas`): Perform rendered for every card without
  hover; ⋯ absent when `canEdit` is false; Delete calls `onDelete` with the
  setlist and does not navigate; the name is a link to the detail.
- `OfflineDownloadAction` render test: the `setlist` variant renders the
  link style; `show` and `toolbar` unchanged.

## 9. PR breakdown

**PR 1 — setlist detail header.**
- `SetlistHeaderActions`, `ReorderToolbar` and their tests (§5, §8).
- `SetlistDetailView`: new header row, role gating (§2.2, §2.6), remove
  `ReorderBanner` and the inline reorder bar.
- `OfflineDownloadAction` `setlist` variant into `OfflineStatusRow` (§2.5).
- i18n keys (§5). CLAUDE.md "Offline download UI" (variant placement) and
  the offline spec's §4.1 note.

**PR 2 — setlist list cards.**
- `SetlistCardItem` single actions block, name link, tests (§3, §8).
- No README change: no feature is added or removed.

Docs: this spec is added to `docs/README.md`, the README Documentation
list and CLAUDE.md "External Documentation" with the spec itself; mark it
implemented when PR 2 merges.

## 10. Open questions

1. **Keep the in-place reorder mode?** `SetlistEditor` already has
   drag-and-drop and the same AI "Optimize order" (its own copy of the
   modal). The detail's mode is faster for a quick swap without the song
   library panel, so this spec keeps it in the menu; dropping it would
   remove ≈300 lines and one of two optimize modals. Recommend deciding
   after a few weeks of the new menu: if nobody opens Reorder from the
   detail, remove it.
2. **Shared `CardActionMenu`** for `SetlistList`, `ShowList`, `RequestList`
   (and `SongList`'s row menu): same `Perform / primary + ⋯` shape, one
   implementation. Worth a small follow-up PR once PR 2 proves the shape.
3. **Rename in the list menu.** Today rename only exists in the detail.
   Cheap to add to the list's ⋯ (`EditSetlistModal` is reusable); left out
   to keep PR 2 small.
4. **"Make available offline" in the list menu**, after the flag is removed
   (offline PR 2.6). The controller already supports starting a download
   from anywhere; the modal re-attaches on navigation.
