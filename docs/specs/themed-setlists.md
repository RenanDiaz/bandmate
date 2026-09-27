# Spec: Themed setlist generation

> **Status:** draft · **Created:** 2026-09-26 · **Owner:** Renán Díaz
> **Origin:** TODO "Generar playlists temáticos".
> **Scope:** a *theme* input on the existing AI setlist generator, the song
> facts the prompt needs to honour it, and response validation. One phase, one PR (§9).
> **Depends on:** nothing. Pairs well with
> [content-permissions.md](content-permissions.md) (hides the generator from
> guests) and [song-country-language.md](song-country-language.md) (ISO codes
> make language/country themes reliable), but does not need either merged.

This is a design, not code. Signatures are the contract; no bodies here.

## 0. Where we are

`AISetlistGenerator` (`src/components/AISetlistGenerator.tsx`, mounted in
`SetlistsView`) already generates a setlist from the band's catalog through
`generateSetlist()` in `src/services/aiSetlistService.ts` (Groq,
`llama-3.3-70b-versatile`, temperature 0.8). The options today: mood
(energetic / chill / mixed / building), length by song count or duration,
split into sets, free-text custom instructions. A theme ("80s night", "acoustic
set", "Christmas", "wedding", "only Spanish songs") can be typed into the
instructions and the model usually obliges. Three things make that unreliable:

1. **The prompt does not carry the facts a theme needs.** `formatSongForPrompt`
   sends title, artist, key, tempo, duration, energy and tags. It never sends
   `release_date` (decades), `language` (language themes) or `country`.
   Above 40 songs, compact mode sends title and artist only. The model then
   guesses from titles.
2. **Free text is not a criterion.** "Special instructions" is one line among
   the requirements; the system prompt's five factors (flow, keys, dynamics,
   pacing, variety) push the other way, so a theme gets diluted to hit the
   requested song count.
3. **The response is not validated.** `parseJsonResponse` is a `JSON.parse`
   cast: an invented `songId` reaches the preview and is saved as `song_id`
   by `createSetlist`; duplicates collide as React keys. Themes make
   invention more likely (the model "wants" a fitting song the catalog lacks).

Nothing here needs new data: `Song` already has `release_date`, `language`,
`country`, `tags`, `energy`, `danceability`.

## 1. Decisions

- **Theme is a first-class option**, separate from mood. Mood is *how the set
  feels*; theme is *which songs qualify*. Both can be set.
- **A theme is a selection constraint, not a suggestion.** When fewer songs
  qualify than requested, the generator returns fewer and says so. It never
  pads with off-theme songs unless the user allows it ("fill with related
  songs" toggle, off by default).
- **Presets + free text.** Six preset chips cover the common asks and send a
  canonical English phrase to the model (stable prompts, no translation
  drift); the free-text field is sent verbatim in whatever language the user
  wrote. Choosing a preset fills the text field; the user can edit it.
- **The prompt gets the facts**: year, language and country join the catalog
  line, in compact mode too (they are short). Tags stay.
- **Validate every response** against the catalog (unknown ids dropped,
  duplicates dropped, `mustInclude` re-checked). This is not theme-specific
  but this PR makes the generator rely on the model more, so it ships here.
- **No new AI calls.** One generation request, same model and limits.
  "Songs to learn for this theme" (`suggestNewSongs` already has an unused
  `forEvent` parameter) is a natural follow-up, not this PR.

## 2. UX

In the expanded generator card, above Mood:

```
Theme (optional)
[ 80s & 90s ] [ Acoustic ] [ Party ] [ Romantic ] [ Holiday ] [ One language ▾ ]
[ text field: e.g. "songs about summer", "only songs in Spanish", "covers from the 70s" ]
[ ] Fill with related songs when the catalog runs short
```

- Presets (`ThemePreset`): `decades-80s-90s`, `acoustic`, `party`,
  `romantic`, `holiday`, `language`. The last one opens a small select of the
  languages present in the catalog (distinct `song.language`, sorted; hidden
  when the catalog has fewer than two) and produces the phrase
  `Only songs in <language>`.
- Selecting a chip writes its canonical phrase into the text field and marks
  the chip active; editing the text clears the active chip. One source of
  truth: the text.
- The theme is passed only when non-empty after trim; `maxLength` 200 (the
  instructions textarea gets the same cap; today it has none).
- Result view: when the response reports `themeShortfall` (§3.3), a warning
  line above the song list: "Only {{count}} of your songs fit this theme" (and,
  when fill was on, "the rest are related picks"). Songs flagged
  `offTheme: true` show a muted "related" badge. The setlist `name` and
  `description` the model returns should reflect the theme; nothing enforces
  it beyond the prompt.
- Everything else (mood, length, sets, instructions, Save & Edit → draft
  editor) unchanged.

## 3. Contract

### 3.1 Options

```ts
export interface SetlistGenerationOptions {
  // …existing fields unchanged…
  /** Selection constraint. Free text or a preset's canonical phrase (§3.4). ≤ 200 chars. */
  theme?: string;
  /** When true, off-theme songs may fill the requested length; they are flagged. Default false. */
  fillWithRelated?: boolean;
}
```

### 3.2 Catalog line

`formatSongForPrompt(song, compact)` adds, in both modes, after the artist:

```
(1987) (lang: es) (country: MX)
```

`year` = first four chars of `release_date` when they parse as a number;
`lang` / `country` = the stored value trimmed (ISO codes once
[song-country-language.md](song-country-language.md) lands; free text until
then, still useful to the model). Omit each when absent. Compact mode keeps
title, artist and these three; it still drops key, tempo, duration, energy
and tags. Expected cost: ≈ 8 tokens per song; 300 songs ≈ 2.4k tokens, within
the compact budget.

### 3.3 Prompt and response

System prompt, added after factor 5:

```
6. THEME: when a theme is given it is a hard filter. Select only songs that
   clearly fit it (use year, language, country, tags, title and your own
   knowledge of the song). If fewer songs fit than requested, return fewer
   and set "themeShortfall". Never pad with songs that do not fit unless
   the request says related songs are allowed; flag those with "offTheme".
```

User prompt, in Requirements, when `theme` is set:

```
- THEME (hard filter): ${theme}
- ${fillWithRelated
    ? "If fewer songs fit than requested, you may add related songs, flagged \"offTheme\": true"
    : "If fewer songs fit than requested, return only the ones that fit"}
```

Response schema gains two optional fields:

```ts
export interface GeneratedSetlist {
  // …existing…
  songs: { songId; title; artist?; notes?; setNumber?; offTheme?: boolean }[];
  /** Present when a theme was set and fewer songs fit than requested. */
  themeShortfall?: { requested: number; matched: number };
}
```

Model settings unchanged (`LLAMA_3_3_70B`, temperature 0.8, 2048 tokens,
compact retry on 413).

### 3.4 Presets

`src/services/setlistThemes.ts` (plain TS, no React):

```ts
export type ThemePreset = "decades-80s-90s" | "acoustic" | "party" | "romantic" | "holiday" | "language";
/** Canonical English phrase sent to the model. `language` takes the language value. */
export function themePhrase(preset: ThemePreset, arg?: string): string;
/** Distinct, sorted, non-empty `song.language` values. */
export function catalogLanguages(songs: Pick<Song, "language">[]): string[];
```

Phrases (exact strings, so prompts stay stable across UI languages):

| Preset | Phrase |
|--------|--------|
| `decades-80s-90s` | `Songs released in the 1980s or 1990s` |
| `acoustic` | `Acoustic or unplugged-friendly songs (low energy, ballads, songs that work stripped down)` |
| `party` | `High-energy party and dance songs the crowd can sing along to` |
| `romantic` | `Romantic songs suitable for a wedding or anniversary` |
| `holiday` | `Christmas and holiday-season songs` |
| `language` | `Only songs in <arg>` |

Chip labels are translated (`ai.themes.<preset>`); phrases are not.

### 3.5 Validation

`src/services/aiSetlistValidation.ts` (pure, unit-tested):

```ts
export interface ValidationReport {
  droppedUnknown: string[];   // songIds not in the catalog
  droppedDuplicates: string[];
  missingMustInclude: string[];
}
export function validateGeneratedSetlist(
  raw: unknown,
  catalog: Pick<Song, "id" | "title" | "artist">[],
  options: Pick<SetlistGenerationOptions, "mustIncludeSongs">,
): { setlist: GeneratedSetlist; report: ValidationReport };
```

Rules: shape-check `name`, `songs[]` (string `songId`); drop entries whose id
is not in the catalog; drop repeats (keep first); coerce `offTheme` to
boolean; `title`/`artist` are re-read from the catalog (the model's copies
are ignored); `themeShortfall` kept only when both numbers are integers ≥ 0.
Throw `Error("ai.emptyResult")` when fewer than one song survives.
`generateSetlist` calls it on every response (compact retry included) and
returns `setlist`; the report goes to `console.warn` in dev and to the
component as a count for "{{count}} suggested songs were not in your catalog
and were removed".

## 4. i18n keys (both `en.json` and `es.json`)

```
ai.theme                      Theme (optional)
ai.themePlaceholder           e.g. songs about summer, only songs in Spanish, covers from the 70s
ai.themes.decades-80s-90s     80s & 90s
ai.themes.acoustic            Acoustic
ai.themes.party               Party
ai.themes.romantic            Romantic
ai.themes.holiday             Holiday
ai.themes.language            One language
ai.themeLanguagePick          Which language?
ai.fillWithRelated            Fill with related songs when the catalog runs short
ai.themeShortfall             Only {{matched}} of your songs fit this theme (you asked for {{requested}})
ai.relatedBadge               related
ai.droppedUnknown             {{count}} suggested songs were not in your catalog and were removed
ai.emptyResult                The AI returned no usable songs. Try a broader theme.
ai.set                        Set {{number}}        ← replaces the hard-coded "Set {n}" badge
```

## 5. Acceptance criteria

`[unit]` Vitest, `[UI]` dev server with a real Groq key (state which model in
the PR), `[prompt]` a unit test on the built prompt string with `groqService`
mocked.

- AC1 `[prompt]` With `theme` set, the system prompt contains factor 6 and the
  user prompt contains `THEME (hard filter): <theme>`; without it, neither
  appears and the prompt is byte-identical to today's (snapshot test).
- AC2 `[prompt]` Each catalog line includes `(YYYY)`, `(lang: …)` and
  `(country: …)` when the song has them, in normal and compact mode; absent
  fields produce no empty parentheses.
- AC3 `[prompt]` `fillWithRelated` switches the shortfall sentence.
- AC4 `[unit]` `themePhrase` returns the table in §3.4; `language` with
  `"es"` returns `Only songs in es`; `catalogLanguages` dedupes, trims, sorts
  and drops empty values.
- AC5 `[unit]` `validateGeneratedSetlist`: unknown ids dropped and reported;
  duplicates dropped; titles replaced from the catalog; malformed JSON shape
  throws; zero survivors throws `ai.emptyResult`; `themeShortfall` kept only
  when well-formed; `missingMustInclude` lists must-include ids absent from
  the result.
- AC6 `[unit]` `generateSetlist` passes the parsed JSON through the validator
  (mocked Groq returning one unknown id + one valid id → one song returned).
- AC7 `[UI]` Clicking a chip fills the text field and highlights the chip;
  editing the text un-highlights; clearing the text sends no theme.
- AC8 `[UI]` "One language" is hidden when the catalog has fewer than two
  distinct languages; otherwise it offers exactly those.
- AC9 `[UI]` Theme and instructions fields refuse more than 200 characters.
- AC10 `[UI]` With a catalog where 4 songs are from the 80s/90s and 12
  requested, preset "80s & 90s" returns ≤ 4 songs and the shortfall warning;
  with fill on, the extra songs carry the "related" badge.
- AC11 `[UI]` "Only songs in Spanish" on a mixed catalog returns only songs
  whose `language` is Spanish (given the field is filled).
- AC12 `[UI]` Save & Edit works unchanged for a themed result; the created
  setlist's name reflects the theme (judgement call, note in PR).
- AC13 `[UI]` Existing flows (no theme) behave as before; the "Set {n}" badge
  is now translated.
- AC14 `npm run lint`, `npm run build`, `npm test` pass; every new string in
  both locales.

## 6. Tests

- `src/services/__tests__/setlistThemes.test.ts` — AC4.
- `src/services/__tests__/aiSetlistValidation.test.ts` — AC5.
- `src/services/__tests__/aiSetlistPrompt.test.ts` — AC1–AC3, AC6, with
  `groqService.complete` mocked to capture the prompt and return a canned JSON
  string. `buildGeneratePrompt` becomes an export (today it is module-private)
  so the snapshot test does not go through the network layer.
- Component: one jsdom test for AC7/AC8 (`renderApp`, `getBandSongs` mocked
  with two languages), no Groq call.

Manual (PR description): AC10–AC12 with a catalog of ≥ 20 songs whose
`release_date` and `language` are filled; note the model used and one
example theme/response pair.

## 7. Risks and non-goals

- **Model quality.** A 70B open model with temperature 0.8 will still
  occasionally misjudge a theme. Validation removes invented songs; it cannot
  detect a real song that does not fit. The shortfall + badge UI makes the
  result auditable before saving, and the editor is one click away.
- **Data quality.** Themes are only as good as `release_date`, `language`,
  `tags`. The metadata lookup fills `release_date`; language is manual today.
  `docs/guides/song-metadata.md` gets a paragraph: "themes use these fields".
- **Key exposure** is unchanged (Groq key inlined as `VITE_*`, known debt on
  the README roadmap). This PR adds no new secret.
- **Not in scope:** suggesting songs to learn for a theme; saving the theme on
  the setlist row; the unused `analyzeSetlist` / `suggestNextSong` paths;
  emitting `setNumber` as section items on save.

## 8. Files touched (expected)

```
src/services/aiSetlistService.ts            theme in options/prompt/catalog line, validator call, export buildGeneratePrompt
src/services/setlistThemes.ts               new
src/services/aiSetlistValidation.ts         new
src/components/AISetlistGenerator.tsx       theme UI, shortfall/related/dropped messages, Set badge i18n
src/i18n/locales/en.json, es.json           §4
src/services/__tests__/…, src/components/__tests__/…   §6
docs/guides/song-metadata.md                "themes use these fields"
README.md                                   Features: "themed generation"
CLAUDE.md                                   services table: setlistThemes, aiSetlistValidation
```

## 9. Phases and PRs

### Phase 1 — themed generation

**Goal:** the AI generator takes a theme (preset or free text), treats it as
a hard filter, reports shortfalls, and never returns an invented song.
**Closes:** AC1–AC14. **Validate (manual):** AC10–AC12 per §6, with the
model used.

- **PR 1.1 — theme input, catalog facts, validation.** Everything in §3,
  §4 and §8.

Definition of done: the `CLAUDE.md` checklist, plus the manual notes in §6.
