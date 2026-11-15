/**
 * Song country and language as ISO codes (docs/specs/song-country-language.md):
 * `songs.country` stores an ISO 3166-1 alpha-2 code (upper case),
 * `songs.language` an ISO 639-1 code (lower case). Names are rendered with
 * `Intl.DisplayNames` in the UI language. A stored value that is not a known
 * code (legacy free text) is shown verbatim, never dropped. Pure: no React,
 * no i18n import.
 */

export type IsoKind = "region" | "language";

/** All ISO 3166-1 alpha-2 codes, upper case. */
export const REGION_CODES: readonly string[] = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS",
  "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN",
  "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE",
  "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF",
  "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM",
  "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM",
  "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC",
  "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK",
  "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA",
  "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG",
  "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS",
  "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO",
  "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI",
  "VN", "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW",
];

/** Curated ISO 639-1 codes that cover music catalogs, lower case. */
export const LANGUAGE_CODES: readonly string[] = [
  "af", "ar", "ca", "cs", "cy", "da", "de", "el", "en", "es", "eu", "fa", "fi", "fr", "ga", "gl",
  "gn", "he", "hi", "ht", "hu", "id", "is", "it", "ja", "ko", "la", "ms", "nl", "no", "pl", "pt",
  "qu", "ro", "ru", "sv", "sw", "th", "tl", "tr", "uk", "vi", "yo", "zh", "zu",
];

const REGION_SET = new Set(REGION_CODES);
const LANGUAGE_SET = new Set(LANGUAGE_CODES);

const canonical = (kind: IsoKind, value: string) =>
  kind === "region" ? value.toUpperCase() : value.toLowerCase();

const codeSet = (kind: IsoKind) => (kind === "region" ? REGION_SET : LANGUAGE_SET);

/** True when `value` is one of the known codes of that kind (case-insensitive). */
export function isKnownCode(kind: IsoKind, value: string): boolean {
  return codeSet(kind).has(canonical(kind, value.trim()));
}

/** Lower case, no accents, no dots, single spaces: "EE.UU." → "eeuu", "Inglés" → "ingles". */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Spellings `Intl.DisplayNames` doesn't produce in English or Spanish. Kept in
 * step with the data migration
 * (supabase/migrations/20261116120000_normalize_song_country_language.sql).
 */
const REGION_ALIASES: Record<string, string> = {
  usa: "US",
  us: "US",
  "united states of america": "US",
  america: "US",
  eeuu: "US",
  "ee uu": "US",
  "estados unidos de america": "US",
  uk: "GB",
  "great britain": "GB",
  britain: "GB",
  "gran bretana": "GB",
  holland: "NL",
  holanda: "NL",
  "south korea": "KR",
  korea: "KR",
  "corea del sur": "KR",
  "north korea": "KP",
  "czech republic": "CZ",
  "republica checa": "CZ",
  russia: "RU",
  rusia: "RU",
  "puerto rico": "PR",
  "dominican republic": "DO",
  "republica dominicana": "DO",
  "ivory coast": "CI",
};

const LANGUAGE_ALIASES: Record<string, string> = {
  castellano: "es",
  espanol: "es",
  spanich: "es",
  ingles: "en",
  engish: "en",
  portugues: "pt",
  frances: "fr",
  aleman: "de",
  italiano: "it",
  japones: "ja",
  coreano: "ko",
  chino: "zh",
  mandarin: "zh",
};

function hasDisplayNames(): boolean {
  return typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function";
}

const displayNamesCache = new Map<string, Intl.DisplayNames | null>();

function displayNames(kind: IsoKind, locale: string): Intl.DisplayNames | null {
  const cacheKey = `${kind}:${locale}`;
  if (!displayNamesCache.has(cacheKey)) {
    let names: Intl.DisplayNames | null = null;
    if (hasDisplayNames()) {
      try {
        names = new Intl.DisplayNames([locale, "en"], { type: kind, fallback: "none" });
      } catch {
        names = null;
      }
    }
    displayNamesCache.set(cacheKey, names);
  }
  return displayNamesCache.get(cacheKey) ?? null;
}

/** Upper-cases the first letter: Spanish language names come lower case ("español"). */
function capitalize(name: string, locale: string): string {
  return name ? name.charAt(0).toLocaleUpperCase(locale) + name.slice(1) : name;
}

function nameOf(kind: IsoKind, code: string, locale: string): string | null {
  try {
    const name = displayNames(kind, locale)?.of(code);
    return name ? capitalize(name, locale) : null;
  } catch {
    return null;
  }
}

const reverseMaps = new Map<IsoKind, Map<string, string>>();

/** Folded English and Spanish names (and aliases) → code, built once per kind. */
function reverseMap(kind: IsoKind): Map<string, string> {
  let map = reverseMaps.get(kind);
  if (map) return map;
  map = new Map();
  const codes = kind === "region" ? REGION_CODES : LANGUAGE_CODES;
  for (const locale of ["en", "es"]) {
    for (const code of codes) {
      const name = nameOf(kind, code, locale);
      if (name && !map.has(fold(name))) map.set(fold(name), code);
    }
  }
  const aliases = kind === "region" ? REGION_ALIASES : LANGUAGE_ALIASES;
  for (const [alias, code] of Object.entries(aliases)) map.set(alias, code);
  reverseMaps.set(kind, map);
  return map;
}

/**
 * Best effort: a code, or an English / Spanish name (case- and
 * accent-insensitive, plus the aliases above) → the code. Null when nothing
 * matches, including non-standard codes such as MusicBrainz's `XW` or `SU`.
 * Never throws.
 */
export function normalizeToCode(kind: IsoKind, raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (isKnownCode(kind, value)) return canonical(kind, value);
  const folded = fold(value);
  if (!folded) return null;
  return reverseMap(kind).get(folded) ?? null;
}

/**
 * Display name for a stored value in `locale`: a known code → its localised
 * name; anything else (legacy free text) → `raw` unchanged. Never throws.
 */
export function displayName(kind: IsoKind, raw: string | null | undefined, locale: string): string {
  const value = raw?.trim() ?? "";
  if (!value || !isKnownCode(kind, value)) return raw ?? "";
  return nameOf(kind, canonical(kind, value), locale) ?? canonical(kind, value);
}

/** Every code of that kind with its name in `locale`, sorted by name. */
export function isoOptions(kind: IsoKind, locale: string): { code: string; name: string }[] {
  const codes = kind === "region" ? REGION_CODES : LANGUAGE_CODES;
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  return codes
    .map((code) => ({ code, name: nameOf(kind, code, locale) ?? code }))
    .sort((a, b) => collator.compare(a.name, b.name));
}

/**
 * The value a select shows for a stored value: a known code in its canonical
 * case ("mx" → "MX"), legacy free text as is, nothing → "".
 */
export function toSelectValue(kind: IsoKind, raw: string | null | undefined): string {
  const value = raw?.trim() ?? "";
  return value && isKnownCode(kind, value) ? canonical(kind, value) : value;
}
