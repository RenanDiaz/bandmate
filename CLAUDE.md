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
├── components/        # React components (views, modals, forms)
├── context/           # React Context: BandContext (global state), ToastContext (notifications)
├── hooks/             # Custom hooks (usePerformanceSync, useLocalBackingTracks)
├── i18n/              # i18next setup + locales/{en,es}.json
├── lib/               # Utilities (supabaseClient, BandStorage, siteConfig, transposition, dates, calendar export)
├── services/          # Supabase + external API data access layer
├── styles/            # CSS design tokens
├── utils/             # Pure helpers (songFilters)
├── theme.ts           # Styled Components theme
├── entry-server.tsx   # Build-time SSR entry for the landing page
├── App.tsx            # Root component with routing
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
| `songsService.ts` | Songs scoped to bands |
| `songSheetMusicService.ts`, `sheetMusicStorageService.ts` | Sheet music PDFs per song (table + Storage), band-wide order via `position` |
| `sheetMusicPreferencesService.ts` | Per-user preferred PDF per song (`user_sheet_music_preferences`) + device-local preferred instrument |
| `setlistsService.ts` | Setlists with embedded song references (JSONB `songs` column) |
| `showsService.ts` | Show/gig scheduling |
| `rehearsalsService.ts` | Rehearsal scheduling |
| `requestsService.ts` | Band requests/proposals with comments and votes |
| `reportsService.ts` | Band reports/statistics |
| `calendarSubscriptionService.ts` | iCal feed subscriptions (served by the `calendar-feed` Edge Function) |
| `performanceSessionService.ts` | Real-time sync sessions using Supabase Realtime |
| `groqService.ts`, `aiSetlistService.ts` | AI setlist generation/optimization (Groq) |
| `spotifyService.ts`, `musicBrainzService.ts`, `metadataService.ts`, `lyricsService.ts`, `youtubeService.ts` | External metadata/lyrics integrations |

**Routing Pattern**: Protected routes show `BandSelector` overlay when user is logged in but no band is selected.

| Route | Description |
|-------|-------------|
| `/` | Landing (logged out) / dashboard (logged in) |
| `/login` | Login |
| `/songs` | Song library (requires auth + band) |
| `/songs/print` | Printable songbook |
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

Unknown paths redirect to `/`. The source of truth is the `<Routes>` block in `src/App.tsx`.

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

**Local backing tracks** (`useLocalBackingTracks` hook): audio files stay on the
device; only a song → file mapping is kept in localStorage. Nothing is uploaded.

### Edge Functions (`supabase/functions/`)

Deno functions deployed with the Supabase CLI (`supabase functions deploy <name>`).
They run with the service role key, so they bypass RLS — validate inputs carefully.

- `calendar-feed` — public iCal feed of a band's shows (token-based, via `calendar_subscriptions`)
- `send-invitation-email` — sends invitation emails via Resend. Needs `RESEND_API_KEY` and `APP_URL`. See [docs/SETUP_EMAIL_SENDING.md](docs/SETUP_EMAIL_SENDING.md).

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
| `calendar_subscriptions` | Tokens for the iCal feed |
| `performance_sessions` | Real-time sync sessions with `current_song_index` |

> The base schema for `bands`, `songs` and `setlists` is **not** versioned in
> this repo — it predates the migrations. Don't assume a fresh database can be
> rebuilt from `migrations/` + `supabase/migrations/` alone.

### Role Permissions

| Action | Owner | Admin | Member | Guest |
|--------|-------|-------|--------|-------|
| View band/songs/setlists | ✅ | ✅ | ✅ | ✅ |
| Create/edit songs | ✅ | ✅ | ✅ | ❌ |
| Create/edit setlists | ✅ | ✅ | ✅ | ❌ |
| Band settings | ✅ | ✅ | ❌ | ❌ |
| Manage members | ✅ | ❌ | ❌ | ❌ |

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
```

> ⚠️ **Every `VITE_*` variable is inlined into the public client bundle.**
> `VITE_SPOTIFY_CLIENT_SECRET` and `VITE_GROQ_API_KEY` are therefore exposed to
> anyone who loads the app. This is known technical debt; the fix is to move
> those calls behind an Edge Function. **Do not add new secrets as `VITE_*`
> variables** — server-side secrets belong in Edge Function env
> (`supabase secrets set`).

## Database Migrations

There are two flows (details in [migrations/README.md](migrations/README.md)):

- **`supabase/migrations/`** — Supabase CLI flow, applied with `supabase db push`.
  **All new migrations go here**, named `<YYYYMMDDHHMMSS>_description.sql`.
- **`migrations/`** — legacy files applied manually via the Supabase Dashboard
  SQL Editor. Kept for reference; do not add new files here.

Migrations must be idempotent where practical (`IF NOT EXISTS`, `DO $$ ... EXCEPTION WHEN duplicate_object`),
following the style of the existing files.

## Testing & Definition of Done

No test framework is configured. Before considering a change done:

1. `npm run lint` passes with no new errors.
2. `npm run build` passes (this also type-checks and runs the SSR pass).
3. Any new user-facing string exists in **both** `en.json` and `es.json`.
4. The flow was exercised manually in the dev server (`http://localhost:5173`)
   with no new console errors — or, if that wasn't possible, say so explicitly.
5. If the change touches RLS or a migration, note which policies were checked.
6. Documentation is up to date (see below).

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
4. If the route should be indexable, add it to `src/lib/siteConfig.ts`
5. Add it to the route table above

### Adding a migration
1. Create `supabase/migrations/<timestamp>_description.sql`
2. Apply with `supabase db push`
3. Update the schema table above if you add a table

## External Documentation

- [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md) - Comprehensive design system
- [docs/LANDING_SEO.md](docs/LANDING_SEO.md) - Landing prerender, meta tags, robots/sitemap
- [docs/SPOTIFY_SETUP.md](docs/SPOTIFY_SETUP.md) - Spotify API integration
- [docs/INVITATION_FLOW_COMPLETE.md](docs/INVITATION_FLOW_COMPLETE.md) - Member invitation system
- [docs/SETUP_EMAIL_SENDING.md](docs/SETUP_EMAIL_SENDING.md) - Invitation emails (Edge Function + Resend)
- [docs/GOOGLE_OAUTH_SETUP.md](docs/GOOGLE_OAUTH_SETUP.md) - Google OAuth configuration
- [migrations/README.md](migrations/README.md) - Database migration guide
