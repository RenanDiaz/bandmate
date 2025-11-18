# Bandmate Development Guide

Welcome to the Bandmate Development Guide. This document outlines the setup, architecture, and best practices for working on the Bandmate application.

## Table of Contents

- [Project Overview](#project-overview)
- [Core Features](#core-features)
- [Development Roadmap](#development-roadmap)
- [Project Setup](#project-setup)
- [Development Workflow](#development-workflow)
- [Architecture](#architecture)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Useful Resources](#useful-resources)

## Project Overview

**Bandmate** is a comprehensive web application designed to help bands manage their songs, setlists, shows, and members in one place. Built with modern web technologies, it helps musicians stay organized and collaborate efficiently.

**Current Implementation Status**:
The application currently supports:
- GitHub OAuth authentication
- Creating and managing multiple bands
- Building a song library with title, artist, lyrics, and chords for each band
- Switching between bands seamlessly
- Dark and light theme toggling

**Vision**:
Bandmate will evolve into a full-featured collaboration platform for bands, including setlist management, show scheduling, member role management, and guest access for temporary collaborators.

**Tech Stack**:
- React 19 + TypeScript
- Vite 6 (build tool)
- Supabase (backend, database, authentication)
- Bootstrap 5 + Reactstrap + Styled Components
- React Router DOM v7
- React Context API for state management

## Core Features

### 1. Bands Management
- Create, edit, and delete bands
- Each band has details such as name, genre, members, and metadata
- Manage membership roles:
  - **Owner/Admin** - Full permissions to manage band settings, members, and content
  - **Members** - Regular contributors who can view/edit songs, setlists, and shows
  - **Guests** - Temporary or invited users with limited access (e.g., fill-in musicians)

### 2. Songs Management
- Register and organize songs with comprehensive metadata:
  - Title, artist, key, tempo
  - Lyrics and chord charts
  - PDF scores, images, or attachments
- Group songs by band
- Search and filter song library
- Version control for song arrangements

### 3. Setlists
- Create setlists for upcoming shows
- Drag-and-drop interface to order songs
- Assign setlists to bands and performance dates
- Print or export setlists for rehearsal and performance
- Save and reuse setlist templates

### 4. Shows Management
- Manage upcoming shows and gigs
- Link each show to a setlist and venue information:
  - Date, time, and location
  - Venue details and contact information
- Track performance history
- Show calendar view

### 5. User Accounts & Authentication
- User registration and login
- GitHub OAuth and Google OAuth implemented
- Multiple OAuth providers supported
- Each user can belong to multiple bands
- Profile management

### 6. Guests & Temporary Members
- Invite temporary users (guests) to access specific bands or setlists
- Time-limited access that expires automatically or can be revoked manually
- Restricted permissions (e.g., view-only setlists)
- Useful for substitute musicians or guest performers

## Development Roadmap

The project follows a phased development approach:

### Phase 1: Foundations ✅ (Current)
- Project setup with React, TypeScript, and Vite
- Authentication system (GitHub OAuth)
- Basic database schema
- Core UI framework with Bootstrap and Styled Components

### Phase 2: Bands Module (In Progress)
- Enhanced CRUD operations for bands
- Member roles and permissions system
- Band settings and configuration
- Member invitation system

### Phase 3: Songs Module Enhancement
- Extended song metadata (key, tempo, genre)
- File upload support for scores and attachments
- Advanced search and filtering
- Song versioning and history

### Phase 4: Setlists
- Setlist creation and editing interface
- Drag-and-drop song ordering
- Assign setlists to shows
- Print/export functionality
- Setlist templates

### Phase 5: Shows Management
- Show/gig scheduling interface
- Venue management
- Calendar integration
- Show history and statistics
- Reminder notifications

### Phase 6: Guests & Invitations
- Temporary access system
- Time-limited invitations
- Guest permission management
- Invitation link generation

### Phase 7: UI/UX Enhancements
- Comprehensive dashboard
- Mobile-responsive design improvements
- Advanced theme customization
- Accessibility improvements (WCAG compliance)
- Performance optimizations

### Phase 8: Polish & Deploy
- Comprehensive QA testing
- Bug fixes and performance tuning
- Production deployment
- Documentation finalization
- User onboarding flow

## Project Setup

### Prerequisites

- Node.js (version 18 or higher)
- npm or yarn
- Git
- Supabase account (for backend services)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd bandmate
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Getting Supabase Credentials**:
1. Create a project at [supabase.com](https://supabase.com)
2. Go to Project Settings > API
3. Copy the Project URL and anon/public key

**Database Setup**:

You'll need to create the following tables in your Supabase project:

**`bands` table**:
```sql
CREATE TABLE bands (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE bands ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own bands
CREATE POLICY "Users can view their own bands"
  ON bands FOR SELECT
  USING (auth.uid() = owner_id);

-- Policy: Users can create bands
CREATE POLICY "Users can create bands"
  ON bands FOR INSERT
  WITH CHECK (auth.uid() = owner_id);
```

**`songs` table**:
```sql
CREATE TABLE songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  artist TEXT,
  lyrics TEXT,
  chords TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own songs
CREATE POLICY "Users can view their own songs"
  ON songs FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create songs
CREATE POLICY "Users can create songs"
  ON songs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

**Authentication Setup**:
1. In Supabase Dashboard, go to Authentication > Providers
2. Enable GitHub and Google providers
3. Add your OAuth app credentials for each provider
4. For detailed Google OAuth setup instructions, see [GOOGLE_OAUTH_SETUP.md](GOOGLE_OAUTH_SETUP.md)

## Development Workflow

### Running the Development Server

Start the development server with hot module replacement (HMR):

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### Building for Production

To build the app for production:

```bash
npm run build
```

The output files will be in the `dist` directory.

### Preview Production Build

To preview the production build locally:

```bash
npm run preview
```

### Linting

To check for linting errors:

```bash
npm run lint
```

## Architecture

### Directory Structure

```
src/
├── components/           # React UI components
│   ├── About.tsx
│   ├── BandList.tsx
│   ├── BandSelector.tsx
│   ├── Home.tsx
│   ├── NewBandForm.tsx
│   ├── NewSongForm.tsx
│   ├── SongList.tsx
│   └── SongsView.tsx
├── context/             # React Context for state management
│   ├── BandContext.tsx  # Main context provider
│   └── useBandContext.ts # Custom hook
├── lib/                 # Utility libraries
│   ├── BandStorage.ts   # localStorage wrapper
│   └── supabaseClient.ts # Supabase client config
├── services/            # API service layer
│   ├── bandsService.ts  # Band CRUD operations
│   └── songsService.ts  # Song CRUD operations
├── assets/              # Static assets
├── App.tsx              # Main app component
├── AuthButton.tsx       # Authentication UI
├── main.tsx             # Entry point
├── theme.ts             # Styled components theme
└── vite-env.d.ts        # Vite type definitions
```

### State Management

The application uses **React Context API** for centralized state management.

**BandContext** (`src/context/BandContext.tsx`) manages:
- `user: User | null` - Currently authenticated user
- `selectedBand: Band | null` - Currently active band
- `bands: Band[]` - List of user's bands
- `showBandSelector: boolean` - Band selector UI visibility
- `setSelectedBand(band)` - Update selected band
- `setShowBandSelector(show)` - Toggle band selector
- `refreshBands()` - Reload bands from database

**State Persistence**:
- Selected band ID is persisted to localStorage via `BandStorage` utility
- Restored on app initialization after authentication
- Cleared only on explicit logout

### Service Layer

The service layer (`src/services/`) provides a clean API abstraction over Supabase:

**bandsService.ts**:
- `getMyBands()` - Fetch user's bands
- `createBand(name)` - Create new band

**songsService.ts**:
- `getMySongs()` - Fetch user's songs
- `createSong(song)` - Create new song

### Data Models

**Band**:
```typescript
interface Band {
  id: number;
  name: string;
  owner_id: string;
  created_at: string;
}
```

**Song**:
```typescript
interface Song {
  id: string;
  user_id: string;
  title: string;
  artist?: string;
  lyrics?: string;
  chords?: string;
  created_at: string;
}
```

### Routing

The application uses React Router v7 with the following routes:

- `/` - Home page (welcome screen)
- `/songs` - Songs view (requires authentication)
- `/about` - About page
- `*` - Catch-all redirects to home

**Protected Content Logic**:
- If user is logged in but no band is selected, show BandSelector
- Guest users can view Home and About, but Songs requires authentication
- Band switching overlays BandSelector on current route

## Coding Standards

### General Guidelines

- Use React functional components with hooks
- Use TypeScript for type safety - avoid `any` types
- Write descriptive commit messages following conventional commits
- Keep components small and focused on a single responsibility
- Prefer composition over inheritance

### TypeScript

- Enable strict mode (already configured)
- Define explicit types for all function parameters and return values
- Use interfaces for object shapes
- Export types that are used across multiple files

### React Best Practices

- Use `useState` for local component state
- Use Context for cross-component state (avoid prop drilling)
- Use `useEffect` sparingly and cleanup side effects
- Memoize expensive computations with `useMemo`
- Memoize callback functions with `useCallback` when passed to child components

### Styling

- Use Bootstrap utilities and Reactstrap components for layout
- Use Styled Components for custom component styling
- Reference theme values from `src/theme.ts`
- Maintain responsive design for mobile devices

### Git Workflow

- Create feature branches from `main` (or current development branch)
- Use descriptive branch names: `feature/add-song-search`, `fix/band-selector-bug`
- Write clear commit messages
- Open pull requests for code review before merging

## Testing

**Current Status**: Testing framework is not yet set up.

**Recommended Setup** (future):
- Jest + React Testing Library for component tests
- Vitest (Vite-native alternative to Jest)
- Test all new components and features
- Focus on user interactions and integration tests over implementation details

## Useful Resources

### Documentation

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [Supabase Documentation](https://supabase.com/docs)
- [React Router v7](https://reactrouter.com/)
- [Bootstrap 5](https://getbootstrap.com/docs/5.3/)
- [Styled Components](https://styled-components.com/)

### Tools

- [Supabase Dashboard](https://app.supabase.com/)
- [React Developer Tools](https://react.dev/learn/react-developer-tools)
- [TypeScript Playground](https://www.typescriptlang.org/play)

---

For questions or help, open an issue in the repository or contact the development team.
