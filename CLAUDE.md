# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev      # Start dev server at http://localhost:5173
npm run build    # tsc -b, then the SSR pass, then the client build (see below)
npm run lint     # ESLint check
npm run preview  # Preview production build locally
npm run og       # Regenerate public/og-image.png (needs sharp)
npm run icons    # Regenerate the PWA icons (needs sharp)
```

`npm run build` runs three steps, not two: `tsc -b`, an SSR build of
`src/entry-server.tsx` into `dist-ssr/`, and then the client build, which
injects the prerendered landing into `index.html`. Use `npm run build` rather
than a bare `vite build` — the latter still succeeds but ships an empty shell.
See [docs/LANDING_SEO.md](docs/LANDING_SEO.md).

## Project Overview

**Bandmate** is a band management web application that helps musicians manage songs, setlists, shows, and collaborate with band members. Built as a PWA for offline support.

**Tech Stack**:
- React 19 + TypeScript
- Vite 6 with PWA support (vite-plugin-pwa/Workbox)
- Supabase (auth, database, real-time)
- Bootstrap 5 + Reactstrap + Styled Components
- React Router v7
- i18next for internationalization (English/Spanish)
- dnd-kit for drag-and-drop

## Architecture Overview

### Directory Structure

```
src/
├── components/        # React components (views, modals, forms)
├── context/           # React Context (BandContext for global state)
├── hooks/             # Custom hooks (usePerformanceSync)
├── i18n/              # Internationalization (en.json, es.json)
├── lib/               # Utilities (supabaseClient, BandStorage)
├── services/          # Supabase data access layer
├── styles/            # CSS design tokens
├── theme.ts           # Styled Components theme
├── App.tsx            # Root component with routing
└── main.tsx           # Entry point
```

### Key Architectural Patterns

**State Management**: Uses React Context (`BandContext`) as the central state store. Access via `useBandContext()` hook. The context manages:
- Authentication state (user)
- Selected band and band list
- Band selector visibility

**Service Layer** (`src/services/`): All Supabase interactions go through service modules. Each service handles CRUD for its domain:
- `bandsService.ts` - Band management, uses `band_members` join table for membership
- `songsService.ts` - Songs scoped to bands
- `setlistsService.ts` - Setlists with embedded song references (JSONB `songs` column)
- `bandMembersService.ts` - Member invitations and roles (owner/admin/member/guest)
- `showsService.ts` - Show/gig scheduling
- `performanceSessionService.ts` - Real-time sync sessions using Supabase Realtime
- `spotifyService.ts`, `musicBrainzService.ts`, `lyricsService.ts` - External API integrations for metadata

**Routing Pattern**: Protected routes show `BandSelector` overlay when user is logged in but no band is selected.

| Route | Description |
|-------|-------------|
| `/` | Home/dashboard |
| `/songs` | Song library (requires auth + band) |
| `/songs/print` | Printable songbook |
| `/setlists` | Setlist management |
| `/setlists/:id` | Setlist detail view |
| `/setlists/:id/edit` | Setlist editor with drag-drop |
| `/setlists/:id/perform` | Performance mode (fullscreen lyrics) |
| `/setlists/:id/print` | Printable setlist |
| `/shows` | Show scheduling |
| `/shows/:id` | Show detail view |
| `/bands/:bandId/settings` | Band settings/members panel |
| `/invite/accept` | Invitation acceptance flow |
| `/about` | About page |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |

### Data Flow

1. User authenticates via OAuth (GitHub/Google) through Supabase Auth
2. `BandContext` loads user's bands via `band_members` table (not `bands.owner_id`)
3. Selected band ID persists to localStorage via `BandStorage` utility
4. Components fetch band-scoped data (songs, setlists, shows) using the selected band ID

### Real-time Features

**Performance Sync** (`usePerformanceSync` hook): Enables synchronized setlist navigation during performances.
- One host controls the current song position
- Viewers automatically follow the host
- Uses Supabase Realtime subscriptions on `performance_sessions` table
- One active session per band at a time

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

Full detail in [docs/LANDING_SEO.md](docs/LANDING_SEO.md).

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
break the dark theme, can't be styled, and feel out of place in the app. Use
well-designed, in-app UI instead:

- **Confirmations** (destructive actions, irreversible changes): use a styled
  confirmation modal, following the pattern in existing modals (e.g.
  `InviteMemberModal.tsx`) — Overlay + ModalContainer + Actions with
  Cancel/Confirm buttons.
- **Success / error / warning messages**: surface them inline within the
  relevant view or modal (e.g. the `FeedbackBanner` pattern in
  `InviteMemberModal.tsx`), not via blocking dialogs.
- Always localize user-facing copy through `t()` (add keys to both `en.json`
  and `es.json`).

> Note: much of the existing codebase still uses `alert()`/`confirm()`. These
> are legacy and should be migrated to in-app UI when touched. Do not add new
> ones.

## Database Schema Notes

All tables use Supabase RLS policies. Key tables:

| Table | Description |
|-------|-------------|
| `bands` | Band info, `owner_id` references creator |
| `band_members` | Join table with `role` enum (owner/admin/member/guest) - RLS disabled, enforced at app level |
| `band_invitations` | Token-based invites with expiration |
| `songs` | Songs with `band_id` FK, lyrics/chords stored as text |
| `setlists` | Setlists with JSONB `songs` array `[{song_id, position, notes?}]` |
| `shows` | Shows/gigs with venue, date, setlist reference |
| `performance_sessions` | Real-time sync sessions with `current_song_index` |

### Role Permissions

| Action | Owner | Admin | Member | Guest |
|--------|-------|-------|--------|-------|
| View band/songs/setlists | ✅ | ✅ | ✅ | ✅ |
| Create/edit songs | ✅ | ✅ | ✅ | ❌ |
| Create/edit setlists | ✅ | ✅ | ✅ | ❌ |
| Band settings | ✅ | ✅ | ❌ | ❌ |
| Manage members | ✅ | ❌ | ❌ | ❌ |

## Environment Variables

Required in `.env`:
```
VITE_SUPABASE_URL=<project_url>
VITE_SUPABASE_ANON_KEY=<anon_key>
```

Optional for metadata features:
```
VITE_SPOTIFY_CLIENT_ID=<spotify_client_id>
```

Optional for AI-powered features:
```
VITE_GROQ_API_KEY=<groq_api_key>
```
Get a free API key at https://console.groq.com. Enables AI-powered setlist generation and optimization.

## Database Migrations

SQL migrations are stored in `/migrations/`. Apply via Supabase Dashboard SQL Editor.

Key migrations:
- `BAND_MEMBERS_MIGRATION_V4.sql` - Band members and invitations system
- `SHOWS_MIGRATION.sql` - Shows/gigs table
- `PERFORMANCE_SESSIONS_MIGRATION.sql` - Real-time sync sessions

## Testing Considerations

- No test framework is currently configured
- Manual testing via dev server at `http://localhost:5173`
- Check browser console for errors
- Verify RLS policies work via Supabase dashboard logs

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@supabase/supabase-js` | Database, auth, real-time |
| `@dnd-kit/*` | Drag-and-drop for setlist editor |
| `react-i18next` | Internationalization |
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
1. Add route in `src/App.tsx` within the `<Routes>` block
2. Create component in `src/components/`
3. Add navigation link if needed in navbar

## External Documentation

- [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md) - Comprehensive design system
- [docs/LANDING_SEO.md](docs/LANDING_SEO.md) - Landing prerender, meta tags, robots/sitemap
- [docs/SPOTIFY_SETUP.md](docs/SPOTIFY_SETUP.md) - Spotify API integration
- [docs/INVITATION_FLOW_COMPLETE.md](docs/INVITATION_FLOW_COMPLETE.md) - Member invitation system
- [docs/GOOGLE_OAUTH_SETUP.md](docs/GOOGLE_OAUTH_SETUP.md) - Google OAuth configuration
- [migrations/README.md](migrations/README.md) - Database migration guide
