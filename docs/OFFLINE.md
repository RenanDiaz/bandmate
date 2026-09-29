# Offline performance

A band member saves a setlist on the device ahead of time and later performs
it with no connection: songs, lyrics, chords, special items and every sheet
music PDF. This page is the entry point. The design lives in the
[intent](intents/offline-performance.md) and the
[Phases 2–3 spec](specs/offline-performance-phase2-3.md). The rules the code
must keep are in [CLAUDE.md](../CLAUDE.md), sections "Offline-safe auth",
"Offline store", "Offline downloads", "Offline download UI", "Offline
screens" and "Performance data".

## Status

| Phase | What | State |
|-------|------|-------|
| 1 | Local pdf.js worker, offline-safe auth, network timeout | Shipped 2026-09-25 |
| 2 | "Make available offline", perform from the saved copy, offline home and screens | Shipped 2026-09-29 (PR 2.6 removed the feature flag) |
| 3 | Update check ("Outdated"), incremental update, offline setlists management | Not started (spec §6, §12) |
| 4 | Backing tracks that survive a restart | Separate intent, not written |

## What works offline

- **Performance mode** of a saved setlist, with every PDF of every song. A
  saved copy is used even online; its rows refresh in the background, PDFs
  never download on their own.
- **Offline home** (`/`), the setlist list and a read-only setlist detail
  with Perform. Every other page says it needs a connection.
- **Choosing a PDF** offline is kept on the device and sent to the server
  when the connection returns. Nothing else is written offline: no reorder,
  notes, uploads or sync sessions.

## Rules worth knowing before changing it

- **Two wipe triggers only:** a sign-out the user chooses, and a different
  user signing in. A session the app loses on its own hides the copies until
  the same user signs in again.
- **Bumping `OFFLINE_SCHEMA_VERSION`** deletes every offline copy on every
  device (users get a "download these again" notice). Justify it in the PR.
- **iOS:** an installed app and a Safari tab have separate storage. Tell
  users to install the app and download inside it.
- **Service worker:** `registerType: 'prompt'`. Never add `skipWaiting`,
  `clientsClaim` or an automatic reload; the reload prompt waits until the
  user leaves performance mode.

## Where the code is

| Area | Files |
|------|-------|
| Store and downloads | `src/services/offlineSetlistService.ts`, `src/lib/offlineStore.ts` (private to the service), `src/lib/offlineFetch.ts` |
| Auth modes | `src/context/offlineAuthController.ts`, `src/context/bandResolution.ts`, `src/lib/authSession.ts` |
| Download UI | `src/components/offline/`, `src/context/offlineDownloadController.ts`, `src/hooks/useOfflineDownload.ts`, `src/hooks/useOfflineStartup.ts` |
| Offline routes | `src/AppMain.tsx` (`OfflineAware`, `useOfflineUi`) |
| Performance mode | `src/hooks/performanceDataController.ts`, `src/hooks/snapshotPerformanceDataSource.ts`, `src/lib/performPosition.ts` |

## Device checklist

Spec §11. Phase 2 was checked on Android before the flag came off
(2026-09-29, results in the spec's changelog). Phase 3 adds its own rows in
PR 3.5.
