import type { Song } from "../services/songsService";
import type { SortOption, FilterOptions } from "../components/SongSearchFilter";

/**
 * Filter songs by search query (searches title and artist)
 */
export function filterBySearch(songs: Song[], query: string): Song[] {
  if (!query.trim()) return songs;

  const lowerQuery = query.toLowerCase().trim();

  return songs.filter((song) => {
    const titleMatch = song.title.toLowerCase().includes(lowerQuery);
    const artistMatch = song.artist?.toLowerCase().includes(lowerQuery) || false;
    return titleMatch || artistMatch;
  });
}

/**
 * Filter songs by content options (has chords, has lyrics, has key, etc.)
 */
export function filterByOptions(songs: Song[], filters: FilterOptions): Song[] {
  let filtered = songs;

  if (filters.hasChords) {
    filtered = filtered.filter((song) => song.chords && song.chords.trim().length > 0);
  }

  if (filters.hasLyrics) {
    filtered = filtered.filter((song) => song.lyrics && song.lyrics.trim().length > 0);
  }

  if (filters.hasKey) {
    filtered = filtered.filter((song) => song.key && song.key.trim().length > 0);
  }

  if (filters.hasTempo) {
    filtered = filtered.filter((song) => song.tempo !== undefined && song.tempo > 0);
  }

  if (filters.hasDuration) {
    filtered = filtered.filter((song) => song.duration !== undefined && song.duration > 0);
  }

  if (filters.hasTags) {
    filtered = filtered.filter((song) => song.tags && song.tags.length > 0);
  }

  return filtered;
}

/**
 * Sort songs by the selected option
 */
export function sortSongs(songs: Song[], sortBy: SortOption): Song[] {
  const sorted = [...songs];

  switch (sortBy) {
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
