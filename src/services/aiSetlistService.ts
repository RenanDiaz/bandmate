/**
 * AI Setlist Generation Service
 *
 * Uses Groq LLM to provide intelligent setlist generation and optimization.
 * Features:
 * - Generate setlists based on band catalog and preferences
 * - Optimize setlist flow (tempo, energy, key transitions)
 * - Learn from previous setlists
 * - Suggest new songs to add to repertoire
 */

import { groqService, GROQ_MODELS, GroqApiError } from "./groqService";
import type { Song } from "./songsService";
import type { Setlist, SetlistItem, SetlistSongItem } from "./setlistsService";
import {
  isSongItem,
  isBreakItem,
  isSectionItem,
  isNoteItem,
} from "./setlistsService";

// ============================================
// Types
// ============================================

export interface SetlistGenerationOptions {
  /** Target duration in minutes */
  targetDuration?: number;
  /** Number of songs to include */
  songCount?: number;
  /** Mood/vibe for the setlist */
  mood?: "energetic" | "chill" | "mixed" | "building";
  /** Include breaks between sets */
  includeSets?: boolean;
  /** Number of sets if includeSets is true */
  numberOfSets?: number;
  /** Songs to always include */
  mustIncludeSongs?: string[];
  /** Songs to exclude */
  excludeSongs?: string[];
  /** Special instructions */
  customInstructions?: string;
}

export interface GeneratedSetlist {
  name: string;
  description: string;
  songs: {
    songId: string;
    title: string;
    artist?: string;
    notes?: string;
    setNumber?: number;
  }[];
  reasoning: string;
  estimatedDuration: number;
}

/** Represents a section/set in the setlist for optimization */
export interface SetlistSection {
  /** Label of the section (e.g., "Set 1", "Encore") or null for implicit section */
  label: string | null;
  /** Type of the divider that starts this section */
  dividerType: "section" | "break" | null;
  /** Song IDs in this section in their current order */
  songIds: string[];
  /** Notes attached to specific songs in this section (songId -> note labels) */
  attachedNotes: Record<string, string[]>;
}

export interface SetlistOptimization {
  currentOrder: string[];
  suggestedOrder: string[];
  changes: {
    from: number;
    to: number;
    songTitle: string;
    reason: string;
  }[];
  overallReasoning: string;
  /** Sections detected in the setlist - used to preserve structure */
  sections?: SetlistSection[];
  /** Optimized sections with new song order per section */
  optimizedSections?: {
    label: string | null;
    suggestedOrder: string[];
  }[];
}

export interface SongSuggestion {
  title: string;
  artist: string;
  reason: string;
  similarTo?: string;
  genre?: string;
  estimatedEnergy?: "low" | "medium" | "high";
}

// ============================================
// Helper Functions
// ============================================

/**
 * Parses a setlist into sections based on section/break items.
 * Also tracks notes that are attached to songs (notes that appear
 * immediately before or after a song are considered attached to it).
 */
function parseSetlistSections(
  items: SetlistItem[],
  songMap: Map<string, Song>
): SetlistSection[] {
  const sections: SetlistSection[] = [];
  let currentSection: SetlistSection = {
    label: null,
    dividerType: null,
    songIds: [],
    attachedNotes: {},
  };

  // Track pending notes that haven't been attached to a song yet
  let pendingNotes: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (isSectionItem(item) || isBreakItem(item)) {
      // Start a new section if current one has songs
      if (currentSection.songIds.length > 0) {
        sections.push(currentSection);
      }
      currentSection = {
        label: item.label,
        dividerType: item.type as "section" | "break",
        songIds: [],
        attachedNotes: {},
      };
      // Reset pending notes for new section
      pendingNotes = [];
    } else if (isNoteItem(item)) {
      // Notes are attached to the next song
      pendingNotes.push(item.label);
    } else if (isSongItem(item)) {
      const song = songMap.get(item.song_id);
      if (song) {
        currentSection.songIds.push(item.song_id);
        // Attach any pending notes to this song
        if (pendingNotes.length > 0) {
          currentSection.attachedNotes[item.song_id] = [
            ...(currentSection.attachedNotes[item.song_id] || []),
            ...pendingNotes,
          ];
          pendingNotes = [];
        }
      }
    }
  }

  // Don't forget the last section
  if (currentSection.songIds.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Formats sections for the AI prompt, including context about dividers and notes.
 */
function formatSectionsForPrompt(
  sections: SetlistSection[],
  songMap: Map<string, Song>,
  compact = false
): string {
  if (sections.length <= 1 && !sections[0]?.label) {
    // No explicit sections, just format as a flat list
    const allSongs = sections.flatMap((s) => s.songIds);
    return allSongs
      .map((songId, index) => {
        const song = songMap.get(songId);
        if (!song) return null;
        const notes = sections[0]?.attachedNotes[songId];
        const noteStr = notes?.length ? ` [Notes: ${notes.join(", ")}]` : "";
        return `${index + 1}. ID:${song.id} | ${formatSongForPrompt(song, compact)}${noteStr}`;
      })
      .filter(Boolean)
      .join("\n");
  }

  // Multiple sections - format with section headers
  let result = "";
  let songIndex = 1;

  sections.forEach((section, sectionIdx) => {
    const sectionHeader = section.label
      ? `\n--- ${section.dividerType === "break" ? "BREAK: " : ""}${section.label} ---\n`
      : sectionIdx > 0
      ? `\n--- Set ${sectionIdx + 1} ---\n`
      : "";
    result += sectionHeader;

    section.songIds.forEach((songId) => {
      const song = songMap.get(songId);
      if (!song) return;
      const notes = section.attachedNotes[songId];
      const noteStr = notes?.length ? ` [Notes: ${notes.join(", ")}]` : "";
      result += `${songIndex}. ID:${song.id} | ${formatSongForPrompt(song, compact)}${noteStr}\n`;
      songIndex++;
    });
  });

  return result.trim();
}

function formatSongForPrompt(song: Song, compact = false): string {
  const parts = [`"${song.title}"`];
  if (song.artist) parts.push(`by ${song.artist}`);
  if (!compact) {
    if (song.key) parts.push(`(Key: ${song.key})`);
    if (song.tempo) parts.push(`(${song.tempo} BPM)`);
    if (song.duration) parts.push(`(${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, "0")})`);
    if (song.energy !== undefined) parts.push(`(Energy: ${(song.energy * 10).toFixed(0)}/10)`);
    if (song.tags?.length) parts.push(`[${song.tags.join(", ")}]`);
  }
  return parts.join(" ");
}

function formatSetlistForPrompt(
  setlist: Setlist,
  songs: Song[],
  compact = false
): string {
  const songMap = new Map(songs.map((s) => [s.id, s]));
  const songItems = setlist.songs.filter(isSongItem);

  const songList = songItems
    .map((item, index) => {
      const song = songMap.get(item.song_id);
      if (!song) return null;
      return `${index + 1}. ${formatSongForPrompt(song, compact)}`;
    })
    .filter(Boolean)
    .join("\n");

  return `Setlist: "${setlist.name}"\n${songList}`;
}

// ============================================
// AI Service Functions
// ============================================

/**
 * Generate a new setlist using AI based on band's catalog and preferences
 */
/**
 * Build the prompt parts for setlist generation.
 * When compact=true, song metadata is reduced to title+artist only and
 * fewer previous setlists are included.
 */
function buildGeneratePrompt(
  songs: Song[],
  previousSetlists: Setlist[],
  options: SetlistGenerationOptions,
  compact: boolean
): { systemPrompt: string; userPrompt: string } {
  const {
    targetDuration,
    songCount,
    mood = "mixed",
    includeSets = false,
    numberOfSets = 2,
    mustIncludeSongs = [],
    excludeSongs = [],
    customInstructions,
  } = options;

  // Build the song catalog
  const availableSongs = songs.filter((s) => !excludeSongs.includes(s.id));
  const songCatalog = availableSongs
    .map((s) => `- ID:${s.id} | ${formatSongForPrompt(s, compact)}`)
    .join("\n");

  // Build previous setlists context — fewer when compact
  const maxSetlists = compact ? 2 : 5;
  const recentSetlists = previousSetlists.slice(0, maxSetlists);
  const setlistHistory =
    recentSetlists.length > 0
      ? recentSetlists
          .map((sl) => formatSetlistForPrompt(sl, songs, compact))
          .join("\n\n")
      : "No previous setlists available.";

  // Build must-include list
  const mustIncludeInfo =
    mustIncludeSongs.length > 0
      ? `\n\nMUST INCLUDE these songs:\n${mustIncludeSongs
          .map((id) => {
            const song = songs.find((s) => s.id === id);
            return song ? `- ${song.title}` : null;
          })
          .filter(Boolean)
          .join("\n")}`
      : "";

  const systemPrompt = `You are an expert music director and setlist curator. Your job is to create optimal setlists for live performances.

Consider these factors when creating setlists:
1. FLOW: Build energy throughout the set, vary tempos to keep audience engaged
2. KEY TRANSITIONS: Avoid jarring key changes between consecutive songs when possible
3. DYNAMICS: Balance high-energy songs with slower moments
4. PACING: Start strong, build to peaks, end memorably
5. VARIETY: Mix different styles/moods while maintaining cohesion

Always respond with valid JSON only, no additional text.`;

  const userPrompt = `Create a setlist for a band with the following song catalog:

${songCatalog}

Previous setlists for reference (to avoid repetitive patterns):
${setlistHistory}
${mustIncludeInfo}

Requirements:
- Mood/vibe: ${mood}
${targetDuration ? `- Target duration: approximately ${targetDuration} minutes` : ""}
${songCount ? `- Number of songs: ${songCount}` : "- Choose an appropriate number of songs"}
${includeSets ? `- Divide into ${numberOfSets} sets with breaks` : ""}
${customInstructions ? `- Special instructions: ${customInstructions}` : ""}

Respond with a JSON object in this exact format:
{
  "name": "Creative name for this setlist",
  "description": "Brief description of the setlist's theme/vibe",
  "songs": [
    {
      "songId": "the song ID from catalog",
      "title": "song title",
      "artist": "artist name",
      "notes": "optional performance notes",
      "setNumber": 1
    }
  ],
  "reasoning": "Explain your choices and the flow you created",
  "estimatedDuration": 90
}`;

  return { systemPrompt, userPrompt };
}

export async function generateSetlist(
  songs: Song[],
  previousSetlists: Setlist[],
  options: SetlistGenerationOptions = {}
): Promise<GeneratedSetlist> {
  if (!groqService.isConfigured()) {
    throw new Error("AI features require Groq API configuration");
  }

  if (songs.length === 0) {
    throw new Error("No songs available to create a setlist");
  }

  // Use compact mode automatically for large catalogs (>40 songs)
  const useCompact = songs.length > 40;
  const { systemPrompt, userPrompt } = buildGeneratePrompt(
    songs,
    previousSetlists,
    options,
    useCompact
  );

  try {
    const response = await groqService.complete(userPrompt, systemPrompt, {
      model: GROQ_MODELS.LLAMA_3_3_70B,
      temperature: 0.8,
      maxTokens: 2048,
    });

    return groqService.parseJsonResponse<GeneratedSetlist>(response);
  } catch (error) {
    // On 413 (payload too large), retry with compact mode if not already using it
    if (error instanceof GroqApiError && error.status === 413 && !useCompact) {
      const compact = buildGeneratePrompt(songs, previousSetlists, options, true);
      const response = await groqService.complete(
        compact.userPrompt,
        compact.systemPrompt,
        {
          model: GROQ_MODELS.LLAMA_3_3_70B,
          temperature: 0.8,
          maxTokens: 2048,
        }
      );
      return groqService.parseJsonResponse<GeneratedSetlist>(response);
    }
    throw error;
  }
}

/**
 * Optimize an existing setlist's song order for better flow.
 * Respects section dividers (Set 1, Set 2, breaks) and keeps notes attached to their songs.
 */
export async function optimizeSetlistOrder(
  setlist: Setlist,
  songs: Song[]
): Promise<SetlistOptimization> {
  if (!groqService.isConfigured()) {
    throw new Error("AI features require Groq API configuration");
  }

  const songMap = new Map(songs.map((s) => [s.id, s]));
  const songItems = setlist.songs.filter(isSongItem) as SetlistSongItem[];

  if (songItems.length < 3) {
    throw new Error("Need at least 3 songs to optimize order");
  }

  // Parse the setlist into sections
  const sections = parseSetlistSections(setlist.songs, songMap);
  const hasSections = sections.length > 1 || sections[0]?.label !== null;

  // Use compact mode for large setlists
  const compact = songItems.length > 30;

  // Format the setlist with section context
  const currentOrderInfo = formatSectionsForPrompt(sections, songMap, compact);

  // Build section-aware prompt
  const sectionContext = hasSections
    ? `\n\nIMPORTANT: This setlist is divided into ${sections.length} section(s). You MUST:
1. Optimize each section INDEPENDENTLY - do not move songs between sections
2. Respect the section boundaries as they represent actual set divisions in the performance
3. Each section should have its own energy arc (build, peak, resolve)
4. Notes attached to songs (like "Tune to Drop D") indicate constraints - keep those songs in positions where the note makes sense

Sections detected:
${sections.map((s, i) => `- ${s.label || `Section ${i + 1}`}: ${s.songIds.length} songs`).join("\n")}`
    : "";

  const systemPrompt = `You are an expert at optimizing setlist flow for live performances.

Analyze the current song order and suggest improvements based on:
1. Energy flow and dynamics
2. Key compatibility between consecutive songs
3. Tempo variation and pacing
4. Building to peaks and memorable endings
5. Audience engagement patterns
${hasSections ? "\nCRITICAL: When the setlist has multiple sections (sets), optimize EACH SECTION SEPARATELY. Never move songs between sections." : ""}

Always respond with valid JSON only, no additional text.`;

  const userPrompt = `Analyze and optimize this setlist order:

Current order:
${currentOrderInfo}
${sectionContext}

Suggest an optimized order that improves the flow.${hasSections ? " Remember to keep songs within their original sections!" : ""} Respond with JSON:
{
  "currentOrder": ["song_id_1", "song_id_2", ...],
  "suggestedOrder": ["song_id_in_new_order", ...],
  ${hasSections ? `"optimizedSections": [
    {
      "label": "Section label or null",
      "suggestedOrder": ["song_ids_in_optimized_order_for_this_section"]
    }
  ],` : ""}
  "changes": [
    {
      "from": 3,
      "to": 1,
      "songTitle": "Song Name",
      "reason": "Why this song should be moved"
    }
  ],
  "overallReasoning": "Explanation of the optimization strategy${hasSections ? " including how each section was optimized" : ""}"
}`;

  const response = await groqService.complete(userPrompt, systemPrompt, {
    model: GROQ_MODELS.LLAMA_3_3_70B,
    temperature: 0.5,
    maxTokens: 2048,
  });

  const result = groqService.parseJsonResponse<SetlistOptimization>(response);

  // Attach the parsed sections for use in the UI
  result.sections = sections;

  return result;
}

/**
 * Suggest new songs to add to the band's repertoire
 */
export async function suggestNewSongs(
  currentSongs: Song[],
  _previousSetlists: Setlist[],
  options: {
    count?: number;
    style?: string;
    forEvent?: string;
  } = {}
): Promise<SongSuggestion[]> {
  if (!groqService.isConfigured()) {
    throw new Error("AI features require Groq API configuration");
  }

  const { count = 5, style, forEvent } = options;

  // Build current catalog summary — cap at 50 songs to avoid oversized prompts
  const cappedSongs = currentSongs.slice(0, 50);
  const catalogSummary = cappedSongs.length > 0
    ? cappedSongs.map((s) => `- "${s.title}" by ${s.artist || "Unknown"}`).join("\n") +
      (currentSongs.length > 50 ? `\n... and ${currentSongs.length - 50} more songs` : "")
    : "Empty catalog - this is a new band.";

  // Extract artists and styles from catalog
  const artists = [...new Set(currentSongs.map((s) => s.artist).filter(Boolean))];
  const tags = [...new Set(currentSongs.flatMap((s) => s.tags || []))];

  const systemPrompt = `You are a music expert helping bands expand their repertoire.

Suggest songs that:
1. Complement the band's existing style
2. Fill gaps in their setlist options
3. Are well-known enough for audiences to enjoy
4. Are realistic for a cover band to perform

Always respond with valid JSON only, no additional text.`;

  const userPrompt = `A band has this current repertoire:

${catalogSummary}

Artists they cover: ${artists.slice(0, 10).join(", ") || "Various"}
Styles/tags: ${tags.slice(0, 10).join(", ") || "Not specified"}
${style ? `Preferred style for new songs: ${style}` : ""}
${forEvent ? `These songs are for: ${forEvent}` : ""}

Suggest ${count} new songs they should learn. Respond with JSON:
{
  "suggestions": [
    {
      "title": "Song Title",
      "artist": "Artist Name",
      "reason": "Why this song would work well for them",
      "similarTo": "Similar to X song they already have",
      "genre": "Rock",
      "estimatedEnergy": "high"
    }
  ]
}`;

  const response = await groqService.complete(userPrompt, systemPrompt, {
    model: GROQ_MODELS.LLAMA_3_3_70B,
    temperature: 0.9,
    maxTokens: 2048,
  });

  const result = groqService.parseJsonResponse<{ suggestions: SongSuggestion[] }>(response);
  return result.suggestions;
}

/**
 * Analyze a setlist and provide feedback
 */
export async function analyzeSetlist(
  setlist: Setlist,
  songs: Song[]
): Promise<{
  strengths: string[];
  suggestions: string[];
  energyProfile: string;
  estimatedAudienceEngagement: "low" | "medium" | "high";
}> {
  if (!groqService.isConfigured()) {
    throw new Error("AI features require Groq API configuration");
  }

  const setlistInfo = formatSetlistForPrompt(setlist, songs);

  const systemPrompt = `You are an expert music director analyzing setlists for live performances.

Evaluate setlists based on:
1. Energy flow and dynamics
2. Pacing and variety
3. Opening and closing strength
4. Overall audience engagement potential

Always respond with valid JSON only, no additional text.`;

  const userPrompt = `Analyze this setlist:

${setlistInfo}

Provide analysis in JSON format:
{
  "strengths": ["What works well about this setlist"],
  "suggestions": ["Specific improvements that could be made"],
  "energyProfile": "Description of the energy flow throughout the set",
  "estimatedAudienceEngagement": "high"
}`;

  const response = await groqService.complete(userPrompt, systemPrompt, {
    model: GROQ_MODELS.LLAMA_3_3_70B,
    temperature: 0.6,
    maxTokens: 1024,
  });

  return groqService.parseJsonResponse(response);
}

/**
 * Get AI suggestions for what song should come next in a setlist
 */
export async function suggestNextSong(
  currentSetlist: SetlistSongItem[],
  availableSongs: Song[],
  allSongs: Song[]
): Promise<{
  suggestions: {
    songId: string;
    title: string;
    reason: string;
    confidence: number;
  }[];
}> {
  if (!groqService.isConfigured()) {
    throw new Error("AI features require Groq API configuration");
  }

  const songMap = new Map(allSongs.map((s) => [s.id, s]));

  // Current setlist so far
  const currentOrder = currentSetlist
    .map((item, index) => {
      const song = songMap.get(item.song_id);
      if (!song) return null;
      return `${index + 1}. ${formatSongForPrompt(song)}`;
    })
    .filter(Boolean)
    .join("\n");

  // Available songs not yet in setlist
  const usedIds = new Set(currentSetlist.map((s) => s.song_id));
  const available = availableSongs.filter((s) => !usedIds.has(s.id));

  if (available.length === 0) {
    return { suggestions: [] };
  }

  const availableList = available
    .map((s) => `- ID:${s.id} | ${formatSongForPrompt(s)}`)
    .join("\n");

  const systemPrompt = `You are helping build a setlist song by song. Suggest the best next song based on flow and energy.

Always respond with valid JSON only, no additional text.`;

  const userPrompt = `Current setlist order:
${currentOrder || "Empty - this will be the first song"}

Available songs to add:
${availableList}

Suggest the top 3 best choices for the next song. Respond with JSON:
{
  "suggestions": [
    {
      "songId": "song_id",
      "title": "Song Title",
      "reason": "Why this is a good next choice",
      "confidence": 0.9
    }
  ]
}`;

  const response = await groqService.complete(userPrompt, systemPrompt, {
    model: GROQ_MODELS.LLAMA_3_1_8B, // Use faster model for quick suggestions
    temperature: 0.7,
    maxTokens: 512,
  });

  return groqService.parseJsonResponse(response);
}
