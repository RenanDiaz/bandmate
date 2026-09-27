# Spec: Lighter app header

> **Status:** draft · **Created:** 2026-09-27 · **Owner:** Renán Díaz
> **Origin:** TODO "Mejorar header de la app, mover About a otra pantalla, no
> es necesario mostrarlo en el navbar, sobre todo en desktop, porque ya ocupa
> mucho espacio".
> **Scope:** the signed-in header fits on one line on desktop and tablets;
> "About" leaves the navigation and stays reachable from the footer and the
> user menu. One phase, one PR (§9). Small; do it before
> [my-upcoming-events.md](my-upcoming-events.md), which would otherwise
> tempt a new nav link.

This is a design, not code. Signatures are the contract; no bodies here.

## 0. Where we are

The header is the top half of `src/App.tsx` (`AppContent`, ≈ 700 lines, most
of them styled components). From left to right, signed in with a band:

| Slot | Content | Notes |
|------|---------|-------|
| Brand | Logo (full on desktop, icon on mobile) + band switcher trigger (name, chevron) | Name truncates at 180 px |
| `DesktopNav` | Home · Songs · Setlists · Shows · Rehearsals · Requests · About | Seven links, `flex: 1`, centred; hidden below `md` (768 px) |
| `DesktopNavActions` | Theme toggle (icon) · `AuthButton` (avatar + **email** + chevron) | Email text hides below `md` only |
| Toggler | Hamburger → `CustomOffcanvas` with the same seven links, icons, theme toggle with label, `AuthButton` | Shown below `md` |

`StyledNavbar` is `expand="md"`, so the desktop layout starts at 768 px: an
iPad in portrait gets seven links, a band name and an email on one 768 px
line, and a long band name or email pushes the actions off the right edge.
The desktop and offcanvas link lists are two hand-written copies.

"About" (`/about`, `src/components/About.tsx`) is a marketing page: it is in
`PUBLIC_ROUTES` (`src/lib/siteConfig.ts`), indexed in the sitemap, static and
usable offline. The only ways to reach it today are the two nav lists.
`Footer` renders on `/about`, `/privacy`, `/terms` and the logged-out landing,
with Privacy and Terms links only. The user menu (`src/AuthButton.tsx`) holds
the email, the language switch and Sign out.

## 1. Decisions

1. **About leaves the navigation, not the app.** Both nav lists drop it. It
   is reachable from the footer (logged out: the landing; everyone: the
   legal pages) and from the user menu (signed in, online or
   `offline-cached`). Route, SEO, sitemap and `PUBLIC_ROUTES` are untouched.
2. **Home leaves the desktop nav; the logo is the home link.** The logo has
   linked to `/` since day one and every other app the users know works that
   way. The offcanvas keeps "Home" as its first row (with its icon): on a
   phone the icon logo is small and a list without a Home row reads as
   incomplete. Reversible in one line if the owner disagrees after AC6.
3. **Desktop layout starts at `lg` (992 px), not `md`.** Tablets in portrait
   (768–991 px) get the offcanvas, which already works and has room. Five
   links, a band name and the actions fit at 992 px with the email hidden
   (decision 4). `BandSwitcher`'s own `useIsMobile()` (< 768 px, sheet vs
   dropdown) is a different question and stays.
4. **The desktop user button is avatar + chevron.** The email is already the
   first line of the open menu ("Signed in as"); showing it twice is what
   costs the width. The offcanvas keeps the email next to the avatar, where
   there is room. `AuthButton` gets a `compact` prop instead of a media
   query so the two placements are explicit.
5. **One list of links.** Desktop and offcanvas render from one
   `NAV_LINKS` array (path, i18n key, icon, active match). Adding a link is
   one line and the two lists cannot drift again. Home is a flag on the
   entry (`offcanvasOnly`), not a second list.
6. **The header moves out of `App.tsx`.** `AppNavbar` (`src/components/`)
   takes `mode` and `onToggleMode` and owns the navbar, the offcanvas and
   their styled components; `App.tsx` keeps the providers, the theme
   attribute, the pending-invite redirect, `AppMain` and the footer. The
   only reason is testability: the header has no test today because it is
   inside the component that mounts `BandProvider`. No visual change comes
   from the move.

Not doing: a new "More" dropdown (five links fit), icons in the desktop
links (they cost the width we are saving), moving the theme toggle into the
user menu (a second click for a frequent toggle on stage).

## 2. UX

- **Desktop (≥ 992 px):** Logo · band name ▾ ‖ Songs · Setlists · Shows ·
  Rehearsals · Requests ‖ ☀/☾ · (avatar ▾). One line at 992 px and 1200 px
  with a 30-character band name; the name truncates with an ellipsis, nothing
  wraps or overflows.
- **Below 992 px:** icon logo · band name ▾ · hamburger. The offcanvas:
  band name + settings, Home, Songs, Setlists, Shows, Rehearsals, Requests
  (icons as today), theme toggle with label, `AuthButton` with the email.
- **User menu** (both placements): Signed in as / offline hint · Language
  · **About Bandmate** (`bi-info-circle`, navigates to `/about`, closes the
  menu) · Sign out.
- **Footer:** About · Privacy Policy · Terms of Service (About first).
  Visibility rules unchanged.
- **Active state:** unchanged (`startsWith` for sections, exact for `/`).
- Nothing changes for the logged-out header (landing: logo, theme toggle,
  Sign in).

## 3. Contract

### 3.1 Links

```ts
// src/components/AppNavbar.tsx
export interface NavLinkDef {
  to: "/" | "/songs" | "/setlists" | "/shows" | "/rehearsals" | "/requests";
  labelKey: string;          // "nav.songs" …
  icon: string;              // "bi-music-note-list" …, offcanvas only
  match: "exact" | "prefix";
  offcanvasOnly?: boolean;   // Home
}
export const NAV_LINKS: readonly NavLinkDef[];
export function isNavLinkActive(link: NavLinkDef, pathname: string): boolean;

interface AppNavbarProps { mode: "light" | "dark"; onToggleMode: () => void; }
export const AppNavbar: FC<AppNavbarProps>;
```

`isNavLinkActive` is the one place the active rule lives (`exact` →
`pathname === to`; `prefix` → `pathname.startsWith(to)`); it is pure and
tested.

### 3.2 AuthButton

```ts
interface AuthButtonProps {
  /** Desktop header: avatar + chevron only; the email stays in the open menu. */
  compact?: boolean;
}
```

The menu gains one item before Sign out:

```tsx
<DropdownItem as={Link} to="/about" onClick={() => setShowUserMenu(false)}>
  <i className="bi bi-info-circle" /> <span>{t("nav.about")}</span>
</DropdownItem>
```

Rendered in every `authMode` that shows the button (`session`,
`offline-cached`): `/about` needs no connection.

### 3.3 Footer

One more `FooterLink` (`to="/about"`, `t("nav.about")`) before Privacy.

### 3.4 Breakpoint

Every `theme.breakpoints.md` media query that belongs to the header
(`DesktopLogo`, `MobileLogo`, `DesktopNav`, `DesktopNavActions`,
`StyledNavbarToggler`, `BandTriggerName`, `NavBrandContainer`) moves to
`theme.breakpoints.lg`, and `StyledNavbar` becomes `expand="lg"`. `UserEmail`
in `AuthButton` drops its media query: `compact` decides.

### 3.5 i18n

No new keys. `nav.about` and `nav.home` stay (footer / menu, offcanvas).

## 4. Acceptance criteria

`[unit]` Vitest (jsdom, `renderApp` with a hand-made context), `[UI]` dev
server.

- AC1 `[unit]` `isNavLinkActive`: `/setlists/abc` marks Setlists and nothing
  else; `/` marks Home only; `/songs/print` marks Songs.
- AC2 `[unit]` `AppNavbar` signed in with a band: the desktop nav lists
  exactly Songs, Setlists, Shows, Rehearsals, Requests (in that order) and
  no Home or About link; the offcanvas lists Home first, then the same five,
  and no About.
- AC3 `[unit]` `AuthButton` (`session`): the open menu has an About item
  that navigates to `/about` and closes the menu; `compact` renders no
  email text in the trigger, the non-compact trigger does. In
  `offline-cached` the About item is present.
- AC4 `[unit]` `Footer` renders About, Privacy, Terms in that order.
- AC5 `[UI]` At 992 px and 1280 px with a band named "Los Guardianes del
  Ritmo Eterno": one line, ellipsis on the name, no horizontal scroll, the
  avatar button fully visible. At 768 px and 900 px (iPad portrait, browser
  window): icon logo, band name, hamburger; the offcanvas opens and every
  link navigates.
- AC6 `[UI]` Logged out: the landing footer's About opens `/about`. Signed
  in: the user menu's About opens `/about` and the footer shows there.
  Tapping the logo returns to `/`.
- AC7 `[UI]` `npm run build` output: `dist/sitemap.xml` still lists
  `/about`; the prerendered landing is unchanged (`git diff --stat` of
  `index.html` markup is empty apart from hashes).
- AC8 `[UI]` Performance mode, print views and the offline home render
  without the header exactly as before (the move in decision 6 changed no
  markup).
- AC9 `npm run lint`, `npm run build`, `npm test` pass.

## 5. Tests

- `src/components/__tests__/AppNavbar.test.tsx` — AC1, AC2 (new file;
  `BandSwitcher` and `AuthButton` may be rendered for real: they only read
  the context; mock `getMyInvitations`).
- `src/__tests__/AuthButton.test.tsx` — AC3 (new file; mock
  `signOutEverywhereOrLocally` and `wipeAll`, never call them).
- `src/components/__tests__/Footer.test.tsx` — AC4 (`renderToStaticMarkup`,
  test i18n instance, `MemoryRouter`).
- Manual: AC5–AC8 in the PR description with the widths used.

## 6. Risks

- **Discoverability of About** drops for signed-in users. Accepted: it is a
  marketing page and the user menu is where "about / version / help" lives
  in most apps. If analytics ever matter, the footer link on the landing is
  what search engines and new visitors see.
- **Breakpoint move touches the band switcher trigger.** `BandTriggerName`
  and `NavBrandContainer` have `md` queries; move them together with the
  rest or the trigger takes `flex: 1` at 900 px and pushes the hamburger.
  AC5 at 900 px catches it.
- **The extraction is a large diff of unchanged code.** Keep it a pure move
  (git detects the rename when the styled components move verbatim) in its
  own commit inside the PR, then the behaviour commits on top, so review is
  "move" + "small diff".

## 7. Out of scope

A "More" menu, icons in desktop links, a notifications slot, the landing's
own header, the offcanvas design, per-band colours in the header, removing
the theme toggle.

## 8. Files touched (expected)

```
src/components/AppNavbar.tsx                      new: navbar + offcanvas, NAV_LINKS, isNavLinkActive (moved from App.tsx)
src/App.tsx                                       providers, theme attribute, invite redirect, <AppNavbar />, footer
src/AuthButton.tsx                                compact prop, About item
src/components/Footer.tsx                         About link
src/components/__tests__/AppNavbar.test.tsx       AC1–AC2
src/__tests__/AuthButton.test.tsx                 AC3
src/components/__tests__/Footer.test.tsx          AC4
CLAUDE.md                                         directory tree (App.tsx line), "Routing Pattern" note on About
README.md                                         no feature change; Documentation list entry for this spec
```

## 9. Phases and PRs

### Phase 1 — one-line header, About out of the nav

**Goal:** the signed-in header fits on one line from 992 px up, the offcanvas
covers everything narrower, and About is reachable from the footer and the
user menu. **Closes:** AC1–AC9. **Validate (manual):** AC5–AC8 on a desktop
browser at the four widths and on an iPad in portrait; record the devices.

- **PR 1.1 — the whole phase.** Two commits: (a) the pure move of the header
  into `AppNavbar` (decision 6), (b) §3 and the tests. "Docs: CLAUDE.md
  directory tree" in the description.

Definition of done: the `CLAUDE.md` checklist. The phase is done when the PR
merges with the manual checklist recorded in its description.
