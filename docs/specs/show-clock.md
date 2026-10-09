# Spec: Show clock in performance mode

> **Status:** Phase 1 implemented (PR 1.1), manual validation (AC8–AC10 on
> device) pending · **Created:** 2026-10-09 · **Owner:** Renán Díaz
> **Origin:** request "un cronómetro para ver cuánto tiempo va de show desde
> que empieza; si la primera canción tiene secuencia, eso lo dispara, si no,
> manual; y poder detenerlo por si solo puse la primera canción para hacer
> soundcheck".
> **Scope:** a stopwatch in performance mode's top bar. One phase, one PR.

## 1. Decisions

1. **Per device, per user and setlist.** The clock lives in `localStorage`
   (`bandmate_show_clock_{userId}_{setlistId}`), like the perform position.
   It is not shared through sync sessions: a viewer runs their own (manual)
   clock. Sharing it is a possible follow-up (§5).
2. **Timestamps, not a counter.** Running stores `startedAt`; the elapsed
   time is `now − startedAt`. A backgrounded tab, a locked iPad or a PWA
   relaunch mid-show keeps the right time.
3. **Three states.** `idle` (0:00) → `running` → `paused` (frozen) →
   Resume (`running`, from the frozen time) or Reset (`idle`).
4. **Automatic start = the first song's backing track starts playing**, only
   from `idle`. "First song" is the first *song item* of the setlist (a
   leading section or note is skipped), and only while it is the current
   item (the player only plays the current song). A paused clock is never
   resumed automatically.
5. **Soundcheck flow.** The track for soundcheck starts the clock → Stop →
   Reset → back to `idle`, armed again for the real start. Two taps, on
   purpose: a single accidental tap mid-show only pauses, and Resume
   recovers it.
6. **Expiry.** A clock whose last activity (start while running, pause after)
   is older than 12 h is discarded on read: next week's show starts at 0:00.
   `wipeAll()` clears every `bandmate_show_clock_*` key (they identify
   setlists), next to the perform positions. No new wipe trigger.
7. **Setlists only.** Hidden for a song target (song-performance spec §2).
   Works offline and for every role (nothing goes to the server).

## 2. Acceptance criteria

- **AC1** Performance mode of a setlist shows the clock in the top bar, next
  to the song counter, at `0:00` with a start button.
- **AC2** Tapping it starts counting (`m:ss`, `h:mm:ss` from one hour).
- **AC3** Running: Stop freezes the time; stopped: Resume continues from the
  frozen time, Reset goes back to `0:00`.
- **AC4** With the clock idle, starting the backing track of the first song
  starts the clock; a backing track of any other song doesn't.
- **AC5** A stopped clock is not restarted by the first song's track.
- **AC6** When the first song has a backing track on this device, the idle
  clock shows a note icon and its title says it starts on its own.
- **AC7** Not shown in single-song performance mode.
- **AC8** Reloading / relaunching the app mid-show keeps the elapsed time.
- **AC9** Locking the iPad for a few minutes and coming back shows the real
  elapsed time.
- **AC10** Soundcheck: first song's track → clock starts → Stop → Reset →
  `0:00`; playing the track again later starts it again.

## 3. Design

| Piece | Where |
|-------|-------|
| State, format, storage, `clearAllShowClocks` (pure) | `src/lib/showClock.ts` |
| Hook (`clock`, `elapsedMs`, `start`, `pause`, `reset`, `startIfIdle`) | `src/hooks/useShowClock.ts` |
| Presentational control | `src/components/ShowClockControl.tsx` |
| Wiring: render in `TopBarRow`, `startIfIdle` from `handleAudioPlayingChange` | `SetlistPerformanceView.tsx` |
| Wipe | `runWipe` in `offlineSetlistService.ts` |

The automatic start hooks the player's `onPlayingChange(true)`. If the
engine's watchdog then finds the audio didn't really start (CLAUDE.md,
"Never pretend to play"), the clock keeps running: the musician taps play
again within seconds, and Reset is there if it matters.

## 4. Phases and PRs

### Phase 1 — Show clock

**Goal:** see how long the show has been running, started by the first
song's backing track or by hand, and stoppable for a soundcheck.
**Closes:** AC1–AC10.
**Validate (manual):** AC1–AC7 in the dev server; AC8–AC10 on the iPad
(installed app) with a real backing track.

- **PR 1.1** — everything in §3, with unit tests (`showClock.test.ts`,
  `useShowClock.test.ts`, `ShowClockControl.test.tsx`, wipe in
  `offlineSetlistService.test.ts`, chrome in `PerformanceViewTarget.test.tsx`).

## 5. Not in scope (possible follow-ups)

- Sharing the host's clock with viewers in a sync session.
- Comparing against the setlist's planned duration (over / under time).
- Per-song elapsed time or a set-break split.
