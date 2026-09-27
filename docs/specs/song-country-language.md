# Spec: Song country and language as ISO codes

> **Status:** draft · **Created:** 2026-09-26 · **Owner:** Renán Díaz
> **Origin:** two TODOs — "Al obtener metadatos, si trae el país de origen,
> debería llenarlo con el nombre completo, y no solo la abreviatura" and
> "Quizás los campos de país de origen e idioma deberían ser dropdown y así
> manejar traducciones". They are one change: store a code, show a name.
> **Scope:** the two `songs` columns, the song forms, metadata apply, CSV
> import, the country report. One phase, one PR (§8).

This is a design, not code. Signatures are the contract; no bodies here.

## 0. Where we are

- `songs.country` and `songs.language` are free-text columns (the base
  schema is not versioned; `reportsService` treats them as nullable text).
  The `Song`, `CreateSongInput` and `UpdateSongInput` types have them as
  `string | undefined`.
- **Metadata lookup** (`metadataService.getSongMetadata` →
  `musicBrainzService.getArtistInfo`) copies `artist.country` verbatim into
  the form. MusicBrainz returns the **ISO 3166-1 alpha-2 code** ("US", "MX",
  "GB"), occasionally a non-standard one (`XW` worldwide, `XE` Europe, or
  historical `SU`, `YU`, `DD`). Nothing in the repo converts it. The TODO's
  "abreviatura" is that code.
- **No service returns a song language.** MusicBrainz recordings are fetched
  without works/releases (where `language` lives), Spotify has no language
  field, AcousticBrainz only says instrumental or not.
- **Forms** (`NewSongForm`, `EditSongModal`): two plain text inputs with
  hard-coded English labels and placeholders. The i18n keys `songs.language`,
  `songs.country`, `songs.placeholders.language/country` exist in both
  locales and **are used nowhere**.
- **CSV import** (`ImportSongsModal`): `Language` / `Country` columns, values
  trimmed, nothing else.
- **Display:** the only reader is Band Reports "Songs by Country"
  (`getCountryDistribution`), which groups by the **raw stored string**:
  "USA", "United States", "Estados Unidos" and "US" are four rows. `language`
  is never displayed anywhere.
- No `Intl.DisplayNames` use, no country/language constants, no tests in the
  area.

## 1. Decisions

1. **Store codes, render names.** `country` holds an ISO 3166-1 alpha-2 code
   (upper case); `language` an ISO 639-1 code (lower case). The name is
   computed at render time with `Intl.DisplayNames` in the UI language. No
   dependency: Chrome, Safari, Firefox and Node 22 (full ICU) all have it.
   This satisfies the first TODO (the user sees "United States" / "Estados
   Unidos", never "US") and makes the second one cheap.
2. **Nothing is lost.** A stored value that is not a known code is still
   shown verbatim and still selectable ("Keep 'Estados Unidos'") so editing an
   old song never silently drops data. Old values are normalised on the way
   in (§3.2) and, once, in the database for the common spellings (§3.5).
3. **No column change.** The columns stay text with no CHECK constraint: the
   base schema is unversioned and free text must remain valid for the
   "keep as is" case. Validation lives in the app.
4. **Metadata keeps filling `country` only**, now normalised: an unknown or
   non-standard code (`XW`, `XE`, `SU`…) is dropped rather than stored. Song
   language from MusicBrainz works (ISO 639-3, needs a second lookup) is a
   follow-up, not this PR.
5. **The lists.** Country: every ISO 3166-1 alpha-2 code (a static array of
   ~249 codes; names from `Intl`). Language: a curated list of ~40 ISO 639-1
   codes that cover music catalogs (es, en, pt, fr, it, de, ja, ko, zh, …),
   names from `Intl`, plus the "keep" entry. Both sorted by the localised
   name, with an empty first option.
6. **Reports group by code** and render the name. Without the data migration
   they would still split old spellings, which is why §3.5 ships too.

Out of scope: showing country/language in `SongList`, the songbook or
performance mode; filtering by them; a language distribution report;
translating the rest of the two forms (only the two fields' labels move to
`t()`; the forms' other hard-coded strings are a separate cleanup, noted in
the PR).

## 2. UX

Both forms, same `FormRow` as today:

```
Language                     Country
[ (none)               ▾ ]   [ (none)                 ▾ ]
  Spanish                      Argentina
  English                      Mexico
  Portuguese                   United States
  …                            …
  Keep "Inglés"  ← only when the current value is not a known code
```

- Labels and the empty option come from `songs.language`, `songs.country`
  and `common.none`. Option names come from `Intl.DisplayNames` in
  `i18n.language`; the list re-sorts when the UI language changes.
- After "Fetch metadata", the Country select shows the fetched country's
  name (e.g. "Mexico"), selected. Language is untouched, as today.
- Band Reports "Songs by Country": names instead of codes/raw strings, one
  row per code; the raw rows that survive normalisation keep showing verbatim.
- CSV import accepts a code (`MX`, `es`) or a name in English or Spanish
  (`Mexico`, `México`, `Spanish`, `Español`); anything else is kept verbatim.
  The in-modal column help says so.

## 3. Contract

### 3.1 `src/lib/isoCodes.ts` (pure, no React, no i18n import)

```ts
export type IsoKind = "region" | "language";

/** All ISO 3166-1 alpha-2 codes, upper case. Static. */
export const REGION_CODES: readonly string[];
/** Curated ISO 639-1 codes, lower case. Static. */
export const LANGUAGE_CODES: readonly string[];

/** True when `value` is one of the known codes of that kind (case-insensitive). */
export function isKnownCode(kind: IsoKind, value: string): boolean;

/**
 * Best effort: a code, or an English/Spanish name (case- and accent-insensitive,
 * common aliases: "USA", "UK", "U.S.", "Estados Unidos", "Inglés") → the code.
 * Returns null when nothing matches. Never throws.
 */
export function normalizeToCode(kind: IsoKind, raw: string | null | undefined): string | null;

/**
 * Display name for a stored value in `locale`. A known code → its localised
 * name; anything else → `raw` unchanged. Never throws (Intl RangeError caught).
 */
export function displayName(kind: IsoKind, raw: string | null | undefined, locale: string): string;

/** Codes with their names in `locale`, sorted by name. */
export function options(kind: IsoKind, locale: string): { code: string; name: string }[];
```

`normalizeToCode` uses `Intl.DisplayNames` for `en` and `es` to build its
reverse map lazily (names → code) plus a short hand-written alias table (USA,
UK, U.S., United States of America, Great Britain, Estados Unidos, Reino
Unido, Inglés, Español, Castellano, Portugués, …). Accents are stripped with
`normalize("NFD")` before comparing.

### 3.2 Normalisation on the way in

`songsService.createSong` / `updateSong` do **not** normalise (services stay
dumb about presentation; also keeps `patchSnapshotSetlist` paths untouched).
The three producers do:

| Producer | Rule |
|----------|------|
| `NewSongForm`, `EditSongModal` submit | the select's value: a code, `""` → `undefined`, or the kept raw string |
| Metadata apply (both forms) | `normalizeToCode("region", metadata.country) ?? prev.country` — an unknown code leaves the field as it was |
| `ImportSongsModal` | `normalizeToCode(kind, cell) ?? cell.trim() \|\| undefined` for both columns |

### 3.3 `src/components/IsoCodeSelect.tsx`

```ts
interface Props {
  kind: IsoKind;
  id: string;
  value: string;                       // "" | code | raw legacy value
  onChange: (value: string) => void;
  disabled?: boolean;
}
```

Renders the styled `Select` the forms already use for Key. Options: empty
(`common.none`), then `options(kind, i18n.language)`, then, when `value` is
non-empty and `!isKnownCode(kind, value)`, one extra option
`t("songs.keepValue", { value })` with that raw value. `value` is compared
case-insensitively to codes and emitted normalised (upper/lower) on change.

### 3.4 Reports

`getCountryDistribution` groups by `normalizeToCode("region", country) ??
country` and returns `{ country: <code or raw>, count }` as today.
`BandReports` renders `displayName("region", item.country, i18n.language)`.

### 3.5 Data migration (one-off, idempotent)

`supabase/migrations/20260927130000_normalize_song_country_language.sql`:
`UPDATE songs SET country = <code> WHERE lower(unaccent-free(country)) IN
(...)` for a fixed list of the common spellings (the alias table of §3.1
frozen into SQL, both languages), and the same for `language`. Rows that
match nothing are left alone. The list is small and explicit (≈ 60 country
spellings, ≈ 30 language spellings); no fuzzy matching in SQL. It runs
before or after the app deploy with the same result.

### 3.6 i18n keys (both locales)

Existing, now used: `songs.language`, `songs.country`. Remove
`songs.placeholders.language` and `songs.placeholders.country` (selects have
no placeholder). New: `common.none` ("(none)" / "(ninguno)") if absent,
`songs.keepValue` ("Keep \"{{value}}\"" / "Mantener \"{{value}}\""),
`songs.import.codesHelp` ("Country and Language accept ISO codes (MX, es) or
names in English or Spanish"). The two forms' labels move to `t()`.

## 4. Acceptance criteria

`[unit]` Vitest (node has full ICU: assert `Intl.DisplayNames` exists in the
test's `beforeAll`, fail loudly otherwise), `[UI]` dev server.

- AC1 `[unit]` `displayName("region","MX","es")` → "México";
  `("region","MX","en")` → "Mexico"; `("language","es","en")` → "Spanish";
  `("region","Estados Unidos","en")` → "Estados Unidos" (raw passthrough);
  `("region","","en")` → ""; an invalid syntax like `"12"` never throws.
- AC2 `[unit]` `normalizeToCode("region", x)` → "US" for "US", "us", "USA",
  "United States", "Estados Unidos", "U.S."; → "GB" for "UK", "United
  Kingdom", "Reino Unido"; → null for "Narnia"; `("language","Español")` →
  "es", `("language","Inglés")` → "en", `("language","EN")` → "en".
- AC3 `[unit]` `normalizeToCode("region","XW")` and `"SU"` → null (not in
  `REGION_CODES`).
- AC4 `[unit]` `options("region","es")` is sorted by Spanish name and has one
  entry per `REGION_CODES` item; `options("language","en")` likewise.
- AC5 `[unit]` `getCountryDistribution` with rows `["US","USA","Estados
  Unidos","MX",""]` returns `[{US,3},{MX,1}]` (supabase mock).
- AC6 `[UI]` New song: Fetch metadata for a song by a Mexican artist selects
  "Mexico" (or "México" in Spanish UI) in the Country select; saving stores
  `MX` (check the row in the dashboard).
- AC7 `[UI]` Edit a song whose stored country is "Inglaterra": the select
  shows and keeps the option "Keep \"Inglaterra\""; picking "United Kingdom"
  stores `GB`.
- AC8 `[UI]` Switching the UI language re-labels the selects without losing
  the selected value.
- AC9 `[UI]` CSV with `Country=México, Language=Español` imports as `MX` /
  `es`; `Country=Atlantis` imports verbatim.
- AC10 `[UI]` Band Reports shows one "United States" row for songs stored as
  `US` (after the data migration, also the old spellings).
- AC11 `[DB]` The data migration is idempotent and only touches rows whose
  value matches the explicit list; `select count(*) … where country not in
  (REGION_CODES)` after it lists only genuinely unknown values.
- AC12 `[UI]` A song whose value is a code is unaffected offline: snapshots
  carry the string and performance mode does not render it (no schema bump).
- AC13 `npm run lint`, `npm run build`, `npm test` pass; every new string in
  both locales; the two removed placeholder keys are gone from both.

## 5. Tests

- `src/lib/__tests__/isoCodes.test.ts` — AC1–AC4.
- `src/services/__tests__/reportsService.test.ts` — AC5 (first test file
  for that service; mock `supabase.from().select().eq()…` like the offline
  tests do).
- `src/components/__tests__/IsoCodeSelect.test.tsx` (jsdom): the "keep"
  option appears only for unknown values; change emits the normalised code.
- Manual (PR description): AC6–AC10 with the project named.

## 6. Risks and notes

- **`Intl.DisplayNames` coverage.** Every supported browser has it (2020+).
  Guard with `typeof Intl.DisplayNames === "function"`; without it
  `displayName` returns the raw value and the selects show codes. Not worth a
  polyfill.
- **Non-standard MusicBrainz codes** are dropped by design (decision 4). The
  user can still pick a country by hand.
- **The alias table is finite.** Anything outside it is kept verbatim and
  visible, so nothing corrupts; it just does not merge in reports until
  edited.
- **Docs:** `docs/guides/song-metadata.md` says the metadata columns come
  from the 2026-01-17 migration; they do not (that file adds album, release
  date, energy…). Fix the sentence and add "Country is stored as an ISO
  3166-1 alpha-2 code, language as ISO 639-1; names are rendered from
  `Intl.DisplayNames`" in the same PR.

## 7. Files touched (expected)

```
src/lib/isoCodes.ts                                     new
src/components/IsoCodeSelect.tsx                        new
src/components/NewSongForm.tsx, EditSongModal.tsx       selects, t() labels, metadata normalise
src/components/ImportSongsModal.tsx                     normalise + help line
src/services/reportsService.ts, src/components/BandReports.tsx   group by code, display name
supabase/migrations/20260927130000_normalize_song_country_language.sql   new
src/i18n/locales/en.json, es.json                       §3.6
src/lib/__tests__/isoCodes.test.ts, src/services/__tests__/reportsService.test.ts,
  src/components/__tests__/IsoCodeSelect.test.tsx       §5
docs/guides/song-metadata.md                            §6
CLAUDE.md                                               lib list: isoCodes; schema note on the two columns
```

## 8. Phases and PRs

### Phase 1 — ISO codes for country and language

**Goal:** country and language are stored as ISO codes and shown as
localised names in the song forms, metadata apply, CSV import and the
country report.
**Closes:** AC1–AC13. **Validate (manual):** AC6–AC10 in the dev server;
AC11 on the project the data migration ran on.

- **PR 1.1 — codes, selects, normalisation, data migration.** Everything in
  §3 and §7.

Definition of done: the `CLAUDE.md` checklist; the PR names the project the
data migration ran on and the count of rows it changed.
