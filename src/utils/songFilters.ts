import type { Song } from "../services/songsService";

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
