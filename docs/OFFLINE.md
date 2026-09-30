# Offline performance

A band member saves a setlist on the device ahead of time and later performs
it with no connection: songs, lyrics, chords, special items and every sheet
music PDF. This page is the entry point. The design lives in the
[intent](intents/offline-performance.md) and the
[Phases 2–3 spec](specs/offline-performance-phase2-3.md). The rules the code
must keep are in [CLAUDE.md](../CLAUDE.md), sections "Offline-safe auth",
"Offline store", "Offline downloads", "Offline update check", "Offline
download UI", "Offline screens" and "Performance data".

## Status

| Phase | What | State |
|-------|------|-------|
| 1 | Local pdf.js worker, offline-safe auth, network timeout | Shipped 2026-09-25 |
| 2 | "Make available offline", perform from the saved copy, offline home and screens | Shipped 2026-09-29 (PR 2.6 removed the feature flag) |
| 3 | Update check ("Outdated"), update of new PDFs only, Offline setlists page | Shipped 2026-09-30 (PRs 3.0–3.5); device checklist pending (below) |
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
- **Offline setlists** (`/offline`, user menu): every copy on the device
  across bands, storage used and whether the browser protects it, Verify
  (reads every PDF back) and Remove. Works offline; Check for updates and
  Update need a connection.

## Keeping copies current (Phase 3)

- With a session and a connection the app checks every copy — on start, 5 s
  after the connection returns, and when a setlist's detail opens — with
  three small queries, never downloading a PDF.
- Changes to order, notes, lyrics, chords, tempo or a PDF's name and timings
  are applied to the copy on their own (it stays "Available offline").
- New sheet music makes a copy **Outdated**: "Update offline copy" downloads
  only the new PDFs. A PDF deleted on the server leaves the copy.
- A setlist deleted on the server (or no longer visible to you) shows
  **Deleted on server**; it still performs until you remove it.
- A failed download of a single PDF leaves the copy **Partial** with Retry;
  losing the connection mid-update keeps the old copy and resumes later.

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
| Update check and management | `checkForUpdates` / `verifySnapshot` in the service, `src/hooks/useOfflineUpdateCheck.ts`, `src/components/offline/OfflineSetlistsManager.tsx` (`/offline`), `offlineBadgeState` in `src/lib/offlineDownloadUi.ts`; migration `supabase/migrations/20260929180000_songs_updated_at.sql` |
| Offline routes | `src/AppMain.tsx` (`OfflineAware`, `useOfflineUi`) |
| Performance mode | `src/hooks/performanceDataController.ts`, `src/hooks/snapshotPerformanceDataSource.ts`, `src/lib/performPosition.ts` |

## Device checklist results

Spec §11 is the checklist; the results live here. Run on an iPhone
(installed from Safari) and an Android phone (installed from Chrome) and
record OS / browser versions.

### Phase 2 (before and after PR 2.6)

| Row (§11) | iPhone | Android |
|-----------|--------|---------|
| Every Phase 2 row not listed below | not reported | ✅ pass (2026-09-29) |
| Airplane mode > 1 h, kill and relaunch: offline home with `S1` (I3) | ✅ pass (2026-09-29) | not reported |
| Captive-portal Wi-Fi relaunch (I5) | not run — accepted | not run — accepted |
| Fill the device storage until a PDF doesn't fit (D4) | not run — accepted | not run — accepted |
| `OFFLINE_SCHEMA_VERSION` bump over existing copies (D7) | not run — covered by unit tests | not run — covered by unit tests |

### Phase 3 (PRs 3.0–3.4) — pending

| Row (§11) | iPhone | Android |
|-----------|--------|---------|
| Reorder `S1` on a laptop; phone comes online: no "Outdated", offline afterwards performs the new order | ⏳ pending | ⏳ pending |
| Add a PDF to `S1` on a laptop; phone comes online: "Outdated" without opening the setlist | ⏳ pending | ⏳ pending |
| Update offline copy: only the new file downloads (watch bytes) | ⏳ pending | ⏳ pending |
| Verify after a week without opening the app: still verified (eviction check) | ⏳ pending | ⏳ pending |
| Sign out from the user menu: Offline setlists is empty; relaunch offline: nothing listed; no `bandmate_perform_position_*` keys | ⏳ pending | ⏳ pending |
| `navigator.storage.persist()` answer shown in Offline setlists ("Protected" / "Not protected") | ⏳ pending (value: —) | ⏳ pending (value: —) |

The "Verify after a week" result is the data point the intent's
iOS-eviction risk asks for: record it per OS even when it passes.
