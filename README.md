# 🎸 Bandmate

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?logo=supabase)](https://supabase.com/)

**Bandmate** helps bands keep their songs, setlists, shows and rehearsals in one
place — and run the show from it. It's an installable PWA, dark-first for
stage lighting, available in English and Spanish.
The installed app checks for a new version whenever it comes back to the
foreground, and the user menu has **Check for updates** (the only way to reload
an installed iOS/iPadOS app without closing it).

Live at **[www.bandmate.space](https://www.bandmate.space)**.

## ✨ Features

**Bands & members**
- GitHub and Google sign-in (Supabase Auth)
- Multiple bands per user, with avatars and ownership transfer
- Email invitations with roles: owner, admin, member, guest

**Songs**
- Song library with key, tempo, lyrics, chords and popularity
- Metadata enrichment from Spotify / MusicBrainz, lyrics lookup
- Transposition, sheet music PDFs (drag-and-drop order, per-musician default in performance mode), and lyric/page timing sync
- CSV import and a printable songbook

**Setlists**
- Drag-and-drop editor, drafts, printable setlists
- Song picker with play history, filters and multi-select; touch-friendly reordering (long-press drag and a Move up / down / to top / to bottom menu)
- Export as text (stage, technical, chat) with copy and share
- Make available offline (behind a feature flag until offline performance ships): save a setlist's songs and sheet music PDFs on the device (from the setlist, its show or performance mode), with progress, partial-download retry and resume after interruptions
- Offline home (same flag): with no connection the app opens on the setlists saved on the device, with a read-only setlist view and Perform; other pages say they need a connection
- AI-assisted setlist generation and optimization (Groq, optional)

**Shows & rehearsals**
- Show scheduling with venue, soundcheck and linked setlist; list and calendar views
- Rehearsal scheduling linked to shows and setlists
- Calendar sync: a personal iCal feed of the band's shows, soundchecks and rehearsals (one tap for Apple, Google and Outlook calendars), plus per-event `.ics` downloads

**Performance mode**
- Full-screen lyrics view with keyboard navigation and reorder on the fly
- Start from any song of a setlist ("Start performance here" in the setlist view); exiting returns to the page you came from
- Perform a single song straight from the song library (chords, lyrics, sheet music, backing track)
- Real-time sync: one host drives the song position, every bandmate follows
- Local backing tracks (audio stays on the device)

**Collaboration**
- Requests: propose new songs, setlist changes, backing tracks; comment and vote
- Band reports: overview stats, song usage, key distribution

## 🚀 Tech Stack

- **Frontend:** React 19, TypeScript, Vite 6, React Router 7, PWA (vite-plugin-pwa)
- **Styling:** Bootstrap 5, Reactstrap, Styled Components
- **Backend:** Supabase — PostgreSQL + RLS, Auth, Realtime, Storage, Edge Functions
- **Other:** dnd-kit, i18next, react-pdf, PapaParse
- **Hosting:** Vercel

## 📦 Getting Started

### Prerequisites
- Node.js 20+ and npm
- A Supabase project, plus the [Supabase CLI](https://supabase.com/docs/guides/cli) for migrations and Edge Functions

### Setup

1. **Clone and install**
   ```bash
   git clone https://github.com/RenanDiaz/bandmate.git
   cd bandmate
   nvm use        # Node 22 (.nvmrc)
   npm install
   ```

2. **Configure environment variables**

   Copy `.env.example` to `.env` and fill in:

   | Variable | Required | Purpose |
   |----------|----------|---------|
   | `VITE_SUPABASE_URL` | ✅ | Supabase project URL |
   | `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
   | `VITE_SPOTIFY_CLIENT_ID` / `VITE_SPOTIFY_CLIENT_SECRET` | — | Spotify metadata ([setup](docs/guides/song-metadata.md)) |
   | `VITE_GROQ_API_KEY` | — | AI setlist features ([free key](https://console.groq.com)) |
   | `VITE_OFFLINE_DOWNLOADS` | — | `true` shows "Make available offline" (off by default until offline performance ships; per device: `localStorage.bandmate_flag_offline = "1"`) |

   > ⚠️ `VITE_*` variables are embedded in the client bundle and are public.
   > Don't put production secrets in them.

3. **Set up the database**

   The whole schema is versioned in `supabase/migrations/`, starting with the
   baseline `20260101000000_baseline.sql` (a dump of production). A new
   Supabase project is created from the repo with:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
   For a local database (Docker): `supabase start`, then `supabase db reset`
   to rebuild it from the migrations. The files in
   [`migrations/`](migrations/README.md) are the legacy history the baseline
   replaces; don't apply them.

4. **Configure authentication** — enable the GitHub and/or Google providers in
   Supabase → Authentication → Providers ([Google guide](docs/setup/google-oauth.md)).

5. **(Optional) Deploy Edge Functions** — `send-invitation-email` (needs a
   Resend key, see [docs/setup/email-sending.md](docs/setup/email-sending.md))
   and `calendar-feed` (public feed read by calendar apps, so no JWT check):
   ```bash
   supabase functions deploy send-invitation-email
   supabase functions deploy calendar-feed --no-verify-jwt
   ```

6. **Run it**
   ```bash
   npm run dev   # http://localhost:5173
   ```

## 🛠️ Scripts

```bash
npm run dev      # Dev server with HMR
npm run build    # Type-check, prerender the landing (SSR), build the client, check the precache
npm run preview  # Preview the production build
npm run lint     # ESLint
npm test         # Unit tests (Vitest)
npm run og       # Regenerate public/og-image.png
npm run icons    # Regenerate PWA icons
```

Always build with `npm run build` — a bare `vite build` skips the landing
prerender and the precache check (which fails the build if a shell file would
be missing offline). See [docs/guides/landing-seo.md](docs/guides/landing-seo.md).

Unit tests run with Vitest (`npm test`); they cover the offline store, the
offline download engine, the offline auth logic and the download UI controller.
The offline download dialogs have render tests (`renderToStaticMarkup`, no DOM).
The offline screens, the online ↔ offline route switch and the weak-signal
fallback have DOM tests (jsdom + Testing Library, opted in per file with
`// @vitest-environment jsdom`). There are no end-to-end tests yet.

## 🗂️ Project Layout

```
src/
├── components/   # Views, modals, forms
├── context/      # BandContext (global state), ToastContext
├── hooks/        # usePerformanceSync, useLocalBackingTracks, useOnlineStatus
├── i18n/         # en / es locales
├── lib/          # Supabase client, storage, site config, helpers
├── services/     # Data access (Supabase + external APIs)
└── App.tsx       # Routes
supabase/
├── functions/    # Edge Functions
└── migrations/   # CLI-managed migrations
migrations/       # Legacy SQL (manual)
docs/             # Guides (index: docs/README.md)
```

Architecture, conventions, routes and the data model are documented in
**[CLAUDE.md](./CLAUDE.md)** — the development guide for both humans and AI agents.

## 📚 Documentation

- [CLAUDE.md](./CLAUDE.md) — architecture, conventions, definition of done
- [docs/README.md](docs/README.md) — index of everything in `docs/`
- [docs/design/style-guide.md](docs/design/style-guide.md) — design system
- [docs/guides/landing-seo.md](docs/guides/landing-seo.md) — landing prerender, SEO, robots/sitemap
- [docs/guides/band-members.md](docs/guides/band-members.md) — roles, member security model, invitations
- [docs/setup/email-sending.md](docs/setup/email-sending.md) — invitation emails
- [docs/guides/song-metadata.md](docs/guides/song-metadata.md) — metadata lookup (Spotify, MusicBrainz, AcousticBrainz) and Spotify setup
- [docs/setup/google-oauth.md](docs/setup/google-oauth.md) — Google OAuth
- [docs/intents/offline-performance.md](docs/intents/offline-performance.md) — intent: offline performance mode (in progress)
- [docs/specs/offline-performance-phase2-3.md](docs/specs/offline-performance-phase2-3.md) — spec: offline performance, Phases 2–3
- [docs/specs/content-permissions.md](docs/specs/content-permissions.md) — spec: content permissions (RLS, services and UI aligned with the role matrix)
- [docs/specs/song-country-language.md](docs/specs/song-country-language.md) — spec: song country/language as ISO codes with localised dropdowns
- [docs/specs/themed-setlists.md](docs/specs/themed-setlists.md) — spec: themed AI setlist generation
- [docs/specs/song-performance.md](docs/specs/song-performance.md) — spec: perform a single song from the library
- [docs/specs/setlist-text-export.md](docs/specs/setlist-text-export.md) — spec: setlist text export (layouts, preview, copy/share)
- [docs/specs/setlist-actions-layout.md](docs/specs/setlist-actions-layout.md) — spec: setlist actions layout (detail header, reorder toolbar, list cards)
- [docs/specs/setlist-builder.md](docs/specs/setlist-builder.md) — spec: setlist builder (song picker with play history and filters, touch reordering, target duration, templates, candidates)
- [docs/specs/setlist-medleys.md](docs/specs/setlist-medleys.md) — spec: medleys (consecutive songs grouped into one entry)
- [docs/specs/app-header.md](docs/specs/app-header.md) — spec (implemented): lighter app header (About out of the nav, one link list, desktop from `lg`)
- [docs/specs/my-upcoming-events.md](docs/specs/my-upcoming-events.md) — spec: my upcoming events across bands on the dashboard
- [migrations/README.md](migrations/README.md) — migrations

## 🗺️ Roadmap

- Move Spotify and Groq calls behind Edge Functions (keep secrets off the client)
- Automated tests

### Backlog (2026-09-27)

- **My upcoming events across bands** — spec: [docs/specs/my-upcoming-events.md](docs/specs/my-upcoming-events.md)

## 🤝 Contributing

1. Create a feature branch
2. Use [conventional commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:` …)
3. Make sure `npm run lint` and `npm run build` pass
4. Update this README and `CLAUDE.md` if your change affects what they describe
5. Open a Pull Request

## 📄 License

MIT — see [LICENSE](LICENSE).

---

**Made with ❤️ for musicians by musicians**
