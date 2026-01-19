import { supabase } from "../lib/supabaseClient";
import type { Song } from "./songsService";
import type { SetlistItem } from "./setlistsService";
import { isSongItem } from "./setlistsService";

// ============================================
// Report Interfaces
// ============================================

export interface BandOverviewStats {
  totalSongs: number;
  totalSetlists: number;
  totalShows: number;
  totalRehearsals: number;
  completedShows: number;
  upcomingShows: number;
  cancelledShows: number;
  completedRehearsals: number;
  scheduledRehearsals: number;
}

export interface SongUsageStats {
  songId: string;
  title: string;
  artist?: string;
  usageCount: number;
}

export interface KeyDistribution {
  key: string;
  count: number;
}

export interface TempoDistribution {
  range: string;
  min: number;
  max: number;
  count: number;
}

export interface MonthlyActivity {
  month: string; // YYYY-MM format
  shows: number;
  rehearsals: number;
}

export interface VenueStats {
  venue: string;
  showCount: number;
}

// ============================================
// Report Functions
// ============================================

/**
 * Get overall band statistics
 */
export async function getBandOverviewStats(bandId: number): Promise<BandOverviewStats> {
  const [songsResult, setlistsResult, showsResult, rehearsalsResult] = await Promise.all([
    supabase.from("songs").select("id", { count: "exact", head: true }).eq("band_id", bandId),
    supabase.from("setlists").select("id", { count: "exact", head: true }).eq("band_id", bandId).or("is_draft.eq.false,is_draft.is.null"),
    supabase.from("shows").select("status").eq("band_id", bandId),
    supabase.from("rehearsals").select("status").eq("band_id", bandId),
  ]);

  const shows = showsResult.data || [];
  const rehearsals = rehearsalsResult.data || [];

  return {
    totalSongs: songsResult.count || 0,
    totalSetlists: setlistsResult.count || 0,
    totalShows: shows.length,
    totalRehearsals: rehearsals.length,
    completedShows: shows.filter((s) => s.status === "completed").length,
    upcomingShows: shows.filter((s) => s.status === "upcoming").length,
    cancelledShows: shows.filter((s) => s.status === "cancelled").length,
    completedRehearsals: rehearsals.filter((r) => r.status === "completed").length,
    scheduledRehearsals: rehearsals.filter((r) => r.status === "scheduled").length,
  };
}

/**
 * Get most used songs in setlists
 */
export async function getMostUsedSongs(bandId: number, limit = 10): Promise<SongUsageStats[]> {
  // Get all setlists and songs
  const [setlistsResult, songsResult] = await Promise.all([
    supabase.from("setlists").select("songs").eq("band_id", bandId).or("is_draft.eq.false,is_draft.is.null"),
    supabase.from("songs").select("id, title, artist").eq("band_id", bandId),
  ]);

  if (setlistsResult.error) throw setlistsResult.error;
  if (songsResult.error) throw songsResult.error;

  const setlists = setlistsResult.data || [];
  const songs = songsResult.data || [];

  // Count song usage across all setlists
  const usageMap = new Map<string, number>();

  setlists.forEach((setlist) => {
    const items = (setlist.songs || []) as SetlistItem[];
    items.forEach((item) => {
      if (isSongItem(item)) {
        usageMap.set(item.song_id, (usageMap.get(item.song_id) || 0) + 1);
      }
    });
  });

  // Build result with song details
  const songMap = new Map(songs.map((s) => [s.id, s]));
  const result: SongUsageStats[] = [];

  usageMap.forEach((count, songId) => {
    const song = songMap.get(songId);
    if (song) {
      result.push({
        songId,
        title: song.title,
        artist: song.artist,
        usageCount: count,
      });
    }
  });

  // Sort by usage count and limit
  return result.sort((a, b) => b.usageCount - a.usageCount).slice(0, limit);
}

/**
 * Get songs that are not used in any setlist
 */
export async function getUnusedSongs(bandId: number): Promise<Song[]> {
  const [setlistsResult, songsResult] = await Promise.all([
    supabase.from("setlists").select("songs").eq("band_id", bandId),
    supabase.from("songs").select("*").eq("band_id", bandId),
  ]);

  if (setlistsResult.error) throw setlistsResult.error;
  if (songsResult.error) throw songsResult.error;

  const setlists = setlistsResult.data || [];
  const songs = songsResult.data || [];

  // Collect all used song IDs
  const usedSongIds = new Set<string>();

  setlists.forEach((setlist) => {
    const items = (setlist.songs || []) as SetlistItem[];
    items.forEach((item) => {
      if (isSongItem(item)) {
        usedSongIds.add(item.song_id);
      }
    });
  });

  // Return songs not in any setlist
  return songs.filter((song) => !usedSongIds.has(song.id));
}

/**
 * Get key distribution of songs
 */
export async function getKeyDistribution(bandId: number): Promise<KeyDistribution[]> {
  const { data, error } = await supabase
    .from("songs")
    .select("key")
    .eq("band_id", bandId)
    .not("key", "is", null);

  if (error) throw error;

  const keyMap = new Map<string, number>();

  (data || []).forEach((song) => {
    if (song.key) {
      keyMap.set(song.key, (keyMap.get(song.key) || 0) + 1);
    }
  });

  const result: KeyDistribution[] = [];
  keyMap.forEach((count, key) => {
    result.push({ key, count });
  });

  // Sort by count descending
  return result.sort((a, b) => b.count - a.count);
}

/**
 * Get tempo distribution of songs
 */
export async function getTempoDistribution(bandId: number): Promise<TempoDistribution[]> {
  const { data, error } = await supabase
    .from("songs")
    .select("tempo")
    .eq("band_id", bandId)
    .not("tempo", "is", null);

  if (error) throw error;

  // Define tempo ranges
  const ranges = [
    { range: "Slow (< 80)", min: 0, max: 79, count: 0 },
    { range: "Medium (80-120)", min: 80, max: 120, count: 0 },
    { range: "Fast (121-160)", min: 121, max: 160, count: 0 },
    { range: "Very Fast (> 160)", min: 161, max: 999, count: 0 },
  ];

  (data || []).forEach((song) => {
    if (song.tempo) {
      const range = ranges.find((r) => song.tempo >= r.min && song.tempo <= r.max);
      if (range) range.count++;
    }
  });

  return ranges.filter((r) => r.count > 0);
}

/**
 * Get monthly activity (shows and rehearsals)
 */
export async function getMonthlyActivity(bandId: number, months = 12): Promise<MonthlyActivity[]> {
  // Calculate date range
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months + 1);
  startDate.setDate(1);

  const startDateStr = startDate.toISOString().split("T")[0];

  const [showsResult, rehearsalsResult] = await Promise.all([
    supabase
      .from("shows")
      .select("event_date, status")
      .eq("band_id", bandId)
      .gte("event_date", startDateStr)
      .in("status", ["completed", "upcoming"]),
    supabase
      .from("rehearsals")
      .select("rehearsal_date, status")
      .eq("band_id", bandId)
      .gte("rehearsal_date", startDateStr)
      .in("status", ["completed", "scheduled"]),
  ]);

  if (showsResult.error) throw showsResult.error;
  if (rehearsalsResult.error) throw rehearsalsResult.error;

  // Build month map
  const monthMap = new Map<string, MonthlyActivity>();

  // Initialize all months
  for (let i = 0; i < months; i++) {
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + i);
    const monthKey = date.toISOString().slice(0, 7); // YYYY-MM
    monthMap.set(monthKey, { month: monthKey, shows: 0, rehearsals: 0 });
  }

  // Count shows
  (showsResult.data || []).forEach((show) => {
    const monthKey = show.event_date.slice(0, 7);
    const entry = monthMap.get(monthKey);
    if (entry) entry.shows++;
  });

  // Count rehearsals
  (rehearsalsResult.data || []).forEach((rehearsal) => {
    const monthKey = rehearsal.rehearsal_date.slice(0, 7);
    const entry = monthMap.get(monthKey);
    if (entry) entry.rehearsals++;
  });

  // Convert to array and sort by month
  return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Get most frequent venues
 */
export async function getTopVenues(bandId: number, limit = 5): Promise<VenueStats[]> {
  const { data, error } = await supabase
    .from("shows")
    .select("venue")
    .eq("band_id", bandId)
    .not("venue", "is", null)
    .neq("venue", "");

  if (error) throw error;

  const venueMap = new Map<string, number>();

  (data || []).forEach((show) => {
    if (show.venue) {
      venueMap.set(show.venue, (venueMap.get(show.venue) || 0) + 1);
    }
  });

  const result: VenueStats[] = [];
  venueMap.forEach((showCount, venue) => {
    result.push({ venue, showCount });
  });

  return result.sort((a, b) => b.showCount - a.showCount).slice(0, limit);
}
