import type { Song } from "../services/songsService";
import { PLAYED_STATUSES, playedStatus, type PlayedStatus, type SongSignals } from "./songSignals";

export type SortOption =
  | "artist_title_asc"
  | "date_desc"
  | "date_asc"
  | "title_asc"
  | "title_desc"
  | "artist_asc"
  | "artist_desc"
  | "tempo_asc"
  | "tempo_desc"
  | "duration_asc"
  | "duration_desc";

export type FilterField = "chords" | "lyrics" | "key" | "tempo" | "duration" | "tags";

// "any" = ignore the field, "has" = must have it, "none" = must not have it
export type FilterState = "any" | "has" | "none";

export type FilterOptions = Record<FilterField, FilterState>;

export const DEFAULT_FILTERS: FilterOptions = {
  chords: "any",
  lyrics: "any",
  key: "any",
  tempo: "any",
  duration: "any",
  tags: "any",
};

/**
 * Filter songs by search query (searches title, artist, and tags)
 */
export function filterBySearch(songs: Song[], query: string): Song[] {
  if (!query.trim()) return songs;

  const lowerQuery = query.toLowerCase().trim();

  return songs.filter((song) => {
    const titleMatch = song.title.toLowerCase().includes(lowerQuery);
    const artistMatch = song.artist?.toLowerCase().includes(lowerQuery) || false;
    const tagsMatch = song.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery)) || false;
    return titleMatch || artistMatch || tagsMatch;
  });
}

/**
 * Predicates describing whether a song "has" each filterable field.
 */
const fieldPredicates: Record<FilterField, (song: Song) => boolean> = {
  chords: (song) => !!song.chords && song.chords.trim().length > 0,
  lyrics: (song) => !!song.lyrics && song.lyrics.trim().length > 0,
  key: (song) => !!song.key && song.key.trim().length > 0,
  tempo: (song) => song.tempo !== undefined && song.tempo > 0,
  duration: (song) => song.duration !== undefined && song.duration > 0,
  tags: (song) => !!song.tags && song.tags.length > 0,
};

/**
 * Filter songs by content options. Each field can require the song to have
 * the field ("has"), to be missing it ("none"), or be ignored ("any").
 */
export function filterByOptions(songs: Song[], filters: FilterOptions): Song[] {
  const fields = Object.keys(fieldPredicates) as FilterField[];

  return songs.filter((song) =>
    fields.every((field) => {
      const state = filters[field];
      if (state === "any") return true;
      const has = fieldPredicates[field](song);
      return state === "has" ? has : !has;
    })
  );
}

/**
 * Sort songs by the selected option
 */
export function sortSongs(songs: Song[], sortBy: SortOption): Song[] {
  const sorted = [...songs];

  switch (sortBy) {
    case "artist_title_asc":
      return sorted.sort((a, b) => {
        const artistA = a.artist || "";
        const artistB = b.artist || "";
        const artistCompare = artistA.localeCompare(artistB, undefined, { sensitivity: "base" });
        if (artistCompare !== 0) return artistCompare;
        return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      });

    case "date_desc":
      return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    case "date_asc":
      return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    case "title_asc":
      return sorted.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));

    case "title_desc":
      return sorted.sort((a, b) => b.title.localeCompare(a.title, undefined, { sensitivity: "base" }));

    case "artist_asc":
      return sorted.sort((a, b) => {
        const artistA = a.artist || "";
        const artistB = b.artist || "";
        return artistA.localeCompare(artistB, undefined, { sensitivity: "base" });
      });

    case "artist_desc":
      return sorted.sort((a, b) => {
        const artistA = a.artist || "";
        const artistB = b.artist || "";
        return artistB.localeCompare(artistA, undefined, { sensitivity: "base" });
      });

    case "tempo_asc":
      return sorted.sort((a, b) => {
        const tempoA = a.tempo || 0;
        const tempoB = b.tempo || 0;
        return tempoA - tempoB;
      });

    case "tempo_desc":
      return sorted.sort((a, b) => {
        const tempoA = a.tempo || 0;
        const tempoB = b.tempo || 0;
        return tempoB - tempoA;
      });

    case "duration_asc":
      return sorted.sort((a, b) => {
        const durationA = a.duration || 0;
        const durationB = b.duration || 0;
        return durationA - durationB;
      });

    case "duration_desc":
      return sorted.sort((a, b) => {
        const durationA = a.duration || 0;
        const durationB = b.duration || 0;
        return durationB - durationA;
      });

    default:
      return sorted;
  }
}

/**
 * Apply all filters and sorting to a list of songs
 */
export function processSongs(
  songs: Song[],
  searchQuery: string,
  filters: FilterOptions,
  sortBy: SortOption
): Song[] {
  let processed = songs;

  // Apply search filter
  processed = filterBySearch(processed, searchQuery);

  // Apply content filters
  processed = filterByOptions(processed, filters);

  // Apply sorting
  processed = sortSongs(processed, sortBy);

  return processed;
}

// ============================================
// Setlist builder picker (docs/specs/setlist-builder.md §6.2)
// ============================================

export type EnergyBand = "low" | "medium" | "high";

export const ENERGY_BANDS: readonly EnergyBand[] = ["low", "medium", "high"];

/** `song.energy` is Spotify's 0–1 scale. */
export const ENERGY_LOW_BELOW = 0.4;
export const ENERGY_HIGH_FROM = 0.7;

export function energyBand(energy: number | undefined | null): EnergyBand | undefined {
  if (typeof energy !== "number" || !Number.isFinite(energy)) return undefined;
  if (energy < ENERGY_LOW_BELOW) return "low";
  if (energy < ENERGY_HIGH_FROM) return "medium";
  return "high";
}

export interface PickerFilters {
  tags: string[];
  keys: string[];
  languages: string[];
  energy: EnergyBand[];
  played: PlayedStatus[];
}

export const EMPTY_PICKER_FILTERS: PickerFilters = {
  tags: [],
  keys: [],
  languages: [],
  energy: [],
  played: [],
};

export type PickerSort =
  | "artist_title_asc" | "title_asc" | "date_desc" // existing SortOption values
  | "most_played" | "longest_since_played";

export const PICKER_SORTS: readonly PickerSort[] = [
  "artist_title_asc",
  "title_asc",
  "date_desc",
  "most_played",
  "longest_since_played",
];

export interface PickerState {
  filters: PickerFilters;
  sort: PickerSort;
}

export const DEFAULT_PICKER_STATE: PickerState = {
  filters: EMPTY_PICKER_FILTERS,
  sort: "artist_title_asc",
};

export function hasActivePickerFilters(filters: PickerFilters): boolean {
  return (Object.keys(filters) as (keyof PickerFilters)[]).some((field) => filters[field].length > 0);
}

function signalsFor(signals: ReadonlyMap<string, SongSignals>, songId: string): SongSignals {
  return signals.get(songId) ?? { songId, timesPlayed: 0, timesInSetlists: 0 };
}

/** OR within a filter, AND across filters; empty arrays match everything. */
export function filterByPicker(
  songs: Song[],
  filters: PickerFilters,
  signals: ReadonlyMap<string, SongSignals>,
  today: string,
): Song[] {
  return songs.filter((song) => {
    if (filters.tags.length > 0 && !song.tags?.some((tag) => filters.tags.includes(tag.trim()))) return false;
    if (filters.keys.length > 0 && !filters.keys.includes(song.key?.trim() ?? "")) return false;
    if (filters.languages.length > 0 && !filters.languages.includes(song.language?.trim() ?? "")) return false;
    if (filters.energy.length > 0) {
      const band = energyBand(song.energy);
      if (!band || !filters.energy.includes(band)) return false;
    }
    if (filters.played.length > 0 && !filters.played.includes(playedStatus(signalsFor(signals, song.id), today))) {
      return false;
    }
    return true;
  });
}

const byTitle = (a: Song, b: Song) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" });

export function sortForPicker(
  songs: Song[],
  sort: PickerSort,
  signals: ReadonlyMap<string, SongSignals>,
): Song[] {
  switch (sort) {
    case "most_played":
      return [...songs].sort(
        (a, b) => signalsFor(signals, b.id).timesPlayed - signalsFor(signals, a.id).timesPlayed || byTitle(a, b)
      );
    case "longest_since_played":
      // Never played first, then the oldest last-played date; ties by title.
      return [...songs].sort((a, b) => {
        const lastA = signalsFor(signals, a.id).lastPlayedAt;
        const lastB = signalsFor(signals, b.id).lastPlayedAt;
        if (lastA !== lastB) {
          if (!lastA) return -1;
          if (!lastB) return 1;
          return lastA < lastB ? -1 : 1;
        }
        return byTitle(a, b);
      });
    default:
      return sortSongs(songs, sort);
  }
}

const distinctSorted = (values: (string | undefined)[]): string[] =>
  [...new Set(values.map((value) => value?.trim()).filter((value): value is string => !!value))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

/** Distinct values present in the catalog, sorted; for the chips. */
export function pickerFacets(songs: Song[]): {
  tags: string[]; keys: string[]; languages: string[]; hasEnergy: boolean;
} {
  return {
    tags: distinctSorted(songs.flatMap((song) => song.tags ?? [])),
    keys: distinctSorted(songs.map((song) => song.key)),
    languages: distinctSorted(songs.map((song) => song.language)),
    hasEnergy: songs.some((song) => energyBand(song.energy) !== undefined),
  };
}

function stringList<T extends string>(value: unknown, allowed?: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  const strings = value.filter((entry): entry is T => typeof entry === "string" && entry.trim() !== "");
  const valid = allowed ? strings.filter((entry) => allowed.includes(entry)) : strings;
  return [...new Set(valid)];
}

/** Parse the stored picker state; anything invalid falls back to defaults. */
export function parseStoredPickerState(raw: string | null): PickerState {
  if (!raw) return DEFAULT_PICKER_STATE;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return DEFAULT_PICKER_STATE;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_PICKER_STATE;
  const record = value as { filters?: unknown; sort?: unknown };
  const filters =
    record.filters && typeof record.filters === "object" && !Array.isArray(record.filters)
      ? (record.filters as Record<string, unknown>)
      : {};
  return {
    filters: {
      tags: stringList(filters.tags),
      keys: stringList(filters.keys),
      languages: stringList(filters.languages),
      energy: stringList(filters.energy, ENERGY_BANDS),
      played: stringList(filters.played, PLAYED_STATUSES),
    },
    sort: PICKER_SORTS.includes(record.sort as PickerSort) ? (record.sort as PickerSort) : DEFAULT_PICKER_STATE.sort,
  };
}
