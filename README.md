# 🎸 Bandmate

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?logo=supabase)](https://supabase.com/)

**Bandmate** is a comprehensive web application designed to help bands manage their songs, setlists, shows, and members in one place. Built with modern web technologies, it helps musicians stay organized and collaborate efficiently.

## ✨ Features

### Current Implementation (Phase 1)
- ✅ **Authentication** - GitHub OAuth integration via Supabase
- ✅ **Band Management** - Create and switch between multiple bands
- ✅ **Song Library** - Organize songs with title, artist, lyrics, and chords
- ✅ **State Management** - React Context API for centralized state
- ✅ **Theme Support** - Dark and light mode toggle
- ✅ **Persistence** - LocalStorage for band selection across sessions

### Planned Features
- 🎵 **Enhanced Song Management** - Key, tempo, attachments, version history
- 📋 **Setlists** - Create and organize setlists with drag-and-drop
- 📅 **Shows** - Schedule gigs and link them to setlists
- 👥 **Collaboration** - Member roles (Owner, Admin, Member, Guest)
- 🔗 **Guest Access** - Time-limited invitations for temporary members
- 📱 **Mobile Optimized** - Responsive design for all devices

## 🚀 Tech Stack

- **Frontend:** React 19, TypeScript, Vite 6
- **Styling:** Bootstrap 5, Reactstrap, Styled Components
- **Backend:** Supabase (PostgreSQL, Authentication, Row Level Security)
- **Routing:** React Router DOM v7
- **State Management:** React Context API

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
│   │   ├── About.tsx
│   │   ├── BandList.tsx
│   │   ├── BandSelector.tsx
│   │   ├── Home.tsx
│   │   ├── NewBandForm.tsx
│   │   ├── NewSongForm.tsx
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

### Phase 1: Foundations ✅ (Current)
- Project setup with React, TypeScript, and Vite
- Authentication system
- Basic band and song management
- Design system and documentation

### Phase 2: Bands Module (In Progress)
- Enhanced CRUD operations
- Member roles and permissions
- Band metadata (genre, location, etc.)

### Phase 3: Songs Module Enhancement
- Extended metadata (key, tempo, genre)
- File uploads for scores
- Advanced search and filtering

### Phase 4: Setlists
- Setlist creation with drag-and-drop
- Link setlists to shows
- Print/export functionality

### Phase 5: Shows Management
- Gig scheduling
- Venue management
- Calendar integration

### Phase 6: Guests & Invitations
- Temporary access system
- Time-limited invitations
- Permission management

### Phase 7: UI/UX Enhancements
- Dashboard view
- Mobile optimization
- Accessibility improvements

### Phase 8: Polish & Deploy
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
