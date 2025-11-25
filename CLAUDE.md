# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev      # Start dev server at http://localhost:5173
npm run build    # TypeScript compile + Vite build (runs tsc -b && vite build)
npm run lint     # ESLint check
npm run preview  # Preview production build locally
```

## Architecture Overview

**Tech Stack**: React 19 + TypeScript, Vite 6, Supabase (auth/database), Bootstrap 5 + Reactstrap, Styled Components, React Router v7

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

**Routing Pattern**: Protected routes show `BandSelector` overlay when user is logged in but no band is selected. Routes:
- `/songs`, `/setlists` - Require auth + selected band
- `/setlists/:id/perform` - Performance mode (fullscreen lyrics view)
- `/bands/:bandId/settings` - Band admin panel
- `/invite/accept` - Invitation acceptance flow

### Data Flow

1. User authenticates via OAuth (GitHub/Google) through Supabase Auth
2. `BandContext` loads user's bands via `band_members` table (not `bands.owner_id`)
3. Selected band ID persists to localStorage via `BandStorage` utility
4. Components fetch band-scoped data (songs, setlists) using the selected band ID

## Styling Conventions

Reference `src/theme.ts` for the design system. Key patterns:
- Dark mode is primary (`data-bs-theme="dark"` on document)
- Styled Components with transient props (`$mode`, `$active`) to avoid DOM warnings
- Brand color: `#8B5CF6` (purple)
- Use `theme.space[n]`, `theme.radius.base`, `theme.colors.dark.*` for consistency
- Icons: Bootstrap Icons (`bi-*` classes)

## Database Schema Notes

- `bands` table: owned by user, but membership determined by `band_members` table
- `band_members`: join table with `role` enum (owner/admin/member/guest)
- `songs.band_id`: FK to bands, songs belong to bands not users
- `setlists.songs`: JSONB array of `{song_id, position, notes?}`
- All tables use Supabase RLS policies

## Environment Variables

Required in `.env`:
```
VITE_SUPABASE_URL=<project_url>
VITE_SUPABASE_ANON_KEY=<anon_key>
```

## External Documentation

- [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md) - Comprehensive design system
- [docs/SPOTIFY_SETUP.md](docs/SPOTIFY_SETUP.md) - Spotify API integration
- [docs/INVITATION_FLOW_COMPLETE.md](docs/INVITATION_FLOW_COMPLETE.md) - Member invitation system
