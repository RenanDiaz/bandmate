# Documentation

The main development guide — architecture, conventions, routes, data model and
definition of done — is [CLAUDE.md](../CLAUDE.md). This folder holds the longer
guides it links to.

```
docs/
├── setup/      # one-time configuration of external services
├── guides/     # how a part of the app works
├── design/     # design system
├── intents/    # why a feature exists and what "done" means
├── specs/      # technical specs, with the phase and PR breakdown
└── research/   # evaluations; not a description of the app
```

## Setup
- [setup/google-oauth.md](setup/google-oauth.md) — Google OAuth provider in Supabase
- [setup/email-sending.md](setup/email-sending.md) — invitation emails (Edge Function + Resend)
- [setup/push-notifications.md](setup/push-notifications.md) — push notifications: VAPID keys, secrets, Vault, deploy, end-to-end check

## Guides
- [guides/band-members.md](guides/band-members.md) — roles, why `band_members` has no RLS, invitation flow, test checklist
- [guides/song-metadata.md](guides/song-metadata.md) — metadata lookup (Spotify, MusicBrainz, AcousticBrainz, Lyrics.ovh) and Spotify setup
- [guides/landing-seo.md](guides/landing-seo.md) — landing prerender, meta tags, robots/sitemap

## Design
- [design/style-guide.md](design/style-guide.md) — design system and brand guidelines
- [design/implementation-examples.md](design/implementation-examples.md) — component examples for the style guide

## Offline performance
- [OFFLINE.md](OFFLINE.md) — entry point: what works offline, the rules that keep it correct, where the code is
- [intents/offline-performance.md](intents/offline-performance.md) — intent (in progress: Phases 1–2 shipped, Phase 3 not started)
- [specs/offline-performance-phase2-3.md](specs/offline-performance-phase2-3.md) — spec for Phases 2–3 (in progress: Phase 2 shipped with PRs 2.0–2.6, Phase 3 in progress)

## Backlog specs (from the 2026-09 TODO review)
- [specs/content-permissions.md](specs/content-permissions.md) — align RLS, services and UI with the role matrix (members edit/delete any content)
- [specs/song-country-language.md](specs/song-country-language.md) — song country/language stored as ISO codes, shown as localised names, dropdowns
- [specs/themed-setlists.md](specs/themed-setlists.md) — theme input on the AI setlist generator + response validation
- [specs/song-performance.md](specs/song-performance.md) — perform a single song from the library (performance target, one phase, two PRs; implemented, manual validation of AC9–AC14 pending)
- [specs/setlist-text-export.md](specs/setlist-text-export.md) — setlist text export: pure formatter, three layouts, preview, copy/share (implemented)
- [specs/setlist-actions-layout.md](specs/setlist-actions-layout.md) — setlist actions by priority: detail header (Perform · Edit · ⋯), sticky reorder toolbar, list cards without hover-reveal (implemented)

## Setlist creation (2026-09-27)
- [specs/setlist-builder.md](specs/setlist-builder.md) — setlist builder: song picker with play history, filters and multi-select, touch reordering, target duration, templates, copy, candidates (three phases, four PRs, no AI; §11 records the AI follow-up)
- [specs/setlist-medleys.md](specs/setlist-medleys.md) — medleys: consecutive songs grouped into one named entry, rendering-only change (one phase, one PR; fragments are v2)

## Header and personal agenda (2026-09-27)
- [specs/app-header.md](specs/app-header.md) — lighter app header: About out of the nav (footer + user menu), one link list, desktop from `lg`, compact user button (one phase, one PR; implemented, manual validation pending)
- [specs/my-upcoming-events.md](specs/my-upcoming-events.md) — my upcoming events: shows and rehearsals of every band on the dashboard, one tap opens the event in its band (one phase, four PRs; implemented, manual validation of AC6–AC9 and AC12 on device pending)

## Notifications (2026-09-27)
- [specs/band-push-notifications.md](specs/band-push-notifications.md) — push notifications when another member adds a show, rehearsal or setlist; moved/cancelled in Phase 2, invitations in Phase 3, flag removal in Phase 4 (four phases, five PRs; in progress, Phase 1 validated, Phases 2 and 3 implemented, device validation pending, Phase 4 not started)

## Research
- [research/external-apis.md](research/external-apis.md) — Setlist.fm, Songstats and other APIs (Nov 2025)

## Elsewhere
- [../migrations/README.md](../migrations/README.md) — database migrations (both flows)

## Adding a doc
Put it in the folder that matches, use `kebab-case.md`, and add it here and to
the **Documentation** list in the root README.
