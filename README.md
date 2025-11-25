# 🎸 Bandmate

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?logo=supabase)](https://supabase.com/)

**Bandmate** is a comprehensive web application designed to help bands manage their songs, setlists, shows, and members in one place. Built with modern web technologies, it helps musicians stay organized and collaborate efficiently.

## ✨ Features

### Current Implementation
- ✅ **Authentication** - GitHub and Google OAuth integration via Supabase
- ✅ **Band Management** - Create, edit, delete bands with member invitations
- ✅ **Song Library** - Full CRUD with title, artist, key, tempo, lyrics, chords, and Spotify metadata enrichment
- ✅ **Setlists** - Create and organize setlists with drag-and-drop song ordering
- ✅ **Setlist Detail View** - View setlist with song cards, reorder mode, and quick actions
- ✅ **Performance Mode** - Full-screen distraction-free view for live performances with auto-scroll lyrics
- ✅ **Reorder Mode** - Drag-and-drop song reordering in both detail and performance views
- ✅ **Shows Management** - Schedule gigs with venue info, link setlists, calendar view
- ✅ **Member Invitations** - Invite members to bands with pending invitation display
- ✅ **State Management** - React Context API for centralized state
- ✅ **Theme Support** - Dark-first design optimized for stage environments
- ✅ **Mobile Optimized** - Responsive design with touch-friendly controls
- ✅ **Persistence** - LocalStorage for band selection across sessions

### Planned Features
- 🎵 **Song Attachments** - File uploads for scores and PDFs
- 👥 **Member Roles** - Owner, Admin, Member, Guest permission levels
- 🔗 **Guest Access** - Time-limited invitations for temporary members
- 📊 **Show History** - Track past performances and statistics

## 🚀 Tech Stack

- **Frontend:** React 19, TypeScript, Vite 6
- **Styling:** Bootstrap 5, Reactstrap, Styled Components
- **Backend:** Supabase (PostgreSQL, Authentication, Row Level Security)
- **Routing:** React Router DOM v7
- **State Management:** React Context API
- **Drag & Drop:** @dnd-kit for sortable lists
- **External APIs:** Spotify Web API for song metadata enrichment

## 📦 Installation

### Prerequisites
- Node.js 18 or higher
- npm or yarn
- Supabase account

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/RenanDiaz/bandmate.git
   cd bandmate
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up Supabase**

   Run the following SQL in your Supabase SQL Editor:

   ```sql
   -- Create bands table
   CREATE TABLE bands (
     id BIGSERIAL PRIMARY KEY,
     name TEXT NOT NULL,
     owner_id UUID NOT NULL REFERENCES auth.users(id),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Create songs table
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
   ALTER TABLE bands ENABLE ROW LEVEL SECURITY;
   ALTER TABLE songs ENABLE ROW LEVEL SECURITY;

   -- Create policies
   CREATE POLICY "Users can view their own bands"
     ON bands FOR SELECT
     USING (auth.uid() = owner_id);

   CREATE POLICY "Users can create bands"
     ON bands FOR INSERT
     WITH CHECK (auth.uid() = owner_id);

   CREATE POLICY "Users can view their own songs"
     ON songs FOR SELECT
     USING (auth.uid() = user_id);

   CREATE POLICY "Users can create songs"
     ON songs FOR INSERT
     WITH CHECK (auth.uid() = user_id);
   ```

5. **Configure GitHub OAuth**
   - In Supabase Dashboard, go to Authentication > Providers
   - Enable GitHub provider
   - Add your GitHub OAuth app credentials

6. **Start the development server**
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:5173`

## 🛠️ Development

### Available Scripts

```bash
npm run dev          # Start development server with HMR
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Project Structure

```
bandmate/
├── src/
│   ├── components/       # React components
│   │   ├── BandList.tsx
│   │   ├── BandSelector.tsx
│   │   ├── Home.tsx
│   │   ├── NewBandForm.tsx
│   │   ├── NewSongForm.tsx
│   │   ├── NewShowForm.tsx
│   │   ├── SetlistEditor.tsx
│   │   ├── SetlistDetailView.tsx
│   │   ├── SetlistPerformanceView.tsx
│   │   ├── SetlistsView.tsx
│   │   ├── ShowsView.tsx
│   │   ├── SongList.tsx
│   │   └── SongsView.tsx
│   ├── context/          # React Context
│   │   ├── BandContext.tsx
│   │   └── useBandContext.ts
│   ├── lib/              # Utilities
│   │   ├── BandStorage.ts
│   │   └── supabaseClient.ts
│   ├── services/         # API services
│   │   ├── bandsService.ts
│   │   ├── setlistsService.ts
│   │   ├── showsService.ts
│   │   └── songsService.ts
│   ├── styles/           # Design tokens
│   │   └── design-tokens.css
│   ├── App.tsx           # Main app component
│   ├── AuthButton.tsx    # Authentication UI
│   ├── main.tsx          # Entry point
│   └── theme.ts          # Theme configuration
├── docs/                 # Documentation files
├── migrations/           # Database migrations
└── CLAUDE.md             # Development guide
```

## 📚 Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Comprehensive development guide with architecture and roadmap
- **[STYLE_GUIDE.md](./docs/STYLE_GUIDE.md)** - Complete design system and brand guidelines
- **[IMPLEMENTATION_EXAMPLES.md](./docs/IMPLEMENTATION_EXAMPLES.md)** - Copy-paste ready component examples
- **[API_RESEARCH.md](./docs/API_RESEARCH.md)** - External API evaluation and integration notes
- **[SPOTIFY_SETUP.md](./docs/SPOTIFY_SETUP.md)** - Spotify API integration guide
- **[GOOGLE_OAUTH_SETUP.md](./docs/GOOGLE_OAUTH_SETUP.md)** - Google OAuth configuration guide

## 🗺️ Roadmap

### Phase 1: Foundations ✅
- Project setup with React, TypeScript, and Vite
- Authentication system (GitHub & Google OAuth)
- Basic band and song management
- Design system and documentation

### Phase 2: Bands Module ✅
- Full CRUD operations for bands
- Member invitation system
- Pending invitations display in band selector

### Phase 3: Songs Module ✅
- Extended metadata (key, tempo, genre)
- Spotify API integration for metadata enrichment
- Album artwork and external links

### Phase 4: Setlists ✅
- Setlist creation with drag-and-drop ordering
- Setlist detail view with song cards
- Reorder mode for quick adjustments
- Link setlists to shows

### Phase 5: Shows Management ✅
- Gig scheduling with venue info
- Calendar view with list/calendar toggle
- Link shows to setlists

### Phase 6: Performance Mode ✅
- Full-screen distraction-free view
- Auto-scroll lyrics with adjustable speed
- Song navigation with keyboard shortcuts
- Mobile-optimized controls
- Reorder mode during performance

### Phase 7: UI/UX Enhancements ✅
- Mobile-first responsive design
- Touch-friendly controls and targets
- Dark-first theme for stage environments

### Phase 8: Collaboration (In Progress)
- Member roles and permissions
- Guest access system
- Time-limited invitations

### Phase 9: Polish & Deploy
- Comprehensive testing
- Production deployment
- User onboarding

## 🎨 Design System

Bandmate uses a custom design system featuring:
- **Brand Color:** Bandmate Purple (#8B5CF6)
- **Typography:** Inter for UI, JetBrains Mono for lyrics/chords
- **Dark-first Design:** Optimized for stage/low-light environments
- **Accessibility:** WCAG AA compliant

See [STYLE_GUIDE.md](./docs/STYLE_GUIDE.md) for complete design specifications.

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes using conventional commits
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Convention

We use conventional commits:
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Test additions or changes
- `chore:` - Maintenance tasks

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with [React](https://react.dev/) and [Vite](https://vitejs.dev/)
- Powered by [Supabase](https://supabase.com/)
- UI components from [Reactstrap](https://reactstrap.github.io/)
- Icons from [Bootstrap Icons](https://icons.getbootstrap.com/)

## 📧 Contact

For questions or feedback, please open an issue on GitHub.

---

**Made with ❤️ for musicians by musicians**
