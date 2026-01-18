/**
 * Chord transposition utilities
 *
 * Handles parsing and transposing chord symbols by semitones.
 * Supports standard chord notation: C, Am, F#m7, Bb/D, Cmaj7, etc.
 */

// Chromatic scale using sharps
const SHARP_NOTES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

// Chromatic scale using flats
const FLAT_NOTES = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];

// Keys that conventionally use flats
const FLAT_KEYS = ["F", "Bb", "Eb", "Ab", "Db", "Gb", "Dm", "Gm", "Cm", "Fm"];

// Regex to match a chord: root note + optional accidental + modifiers + optional bass note
// Examples: C, Am, F#m7, Bb/D, Cmaj7, Gsus4, D7b9
const CHORD_REGEX =
  /^([A-G])([#b])?([^/\s]*)?(?:\/([A-G])([#b])?)?$/;

// Regex to find chords in a line of text (word boundaries)
const CHORD_IN_LINE_REGEX =
  /\b([A-G][#b]?(?:m|maj|min|dim|aug|sus|add|M)?[0-9]?(?:sus[24]|add[0-9]+|maj[0-9]+|m[0-9]+|[0-9]+)?(?:b[0-9]+|#[0-9]+)?(?:\/[A-G][#b]?)?)\b/g;

/**
 * Determines if a key conventionally uses flats or sharps
 */
export function usesFlats(key: string | undefined): boolean {
  if (!key) return false;
  // Remove "m" suffix for minor keys and check
  const normalizedKey = key.replace(/\s*(major|minor|m)$/i, "");
  return FLAT_KEYS.some(
    (k) => k.toLowerCase() === normalizedKey.toLowerCase() || k === key
  );
}

/**
 * Gets the index of a note in the chromatic scale (0-11)
 */
function getNoteIndex(note: string, accidental?: string): number {
  const fullNote = note + (accidental || "");

  // Check sharps first
  let index = SHARP_NOTES.indexOf(fullNote);
  if (index !== -1) return index;

  // Check flats
  index = FLAT_NOTES.indexOf(fullNote);
  if (index !== -1) return index;

  // Handle edge cases like Cb (= B) and E# (= F)
  if (fullNote === "Cb") return 11;
  if (fullNote === "E#") return 5;
  if (fullNote === "Fb") return 4;
  if (fullNote === "B#") return 0;

  return -1;
}

/**
 * Gets the note name at a given index, using sharps or flats based on key context
 */
function getNoteAtIndex(index: number, preferFlats: boolean): string {
  // Normalize index to 0-11 range
  const normalizedIndex = ((index % 12) + 12) % 12;
  return preferFlats
    ? FLAT_NOTES[normalizedIndex]
    : SHARP_NOTES[normalizedIndex];
}

/**
 * Transposes a single note by the given number of semitones
 */
function transposeNote(
  note: string,
  accidental: string | undefined,
  semitones: number,
  preferFlats: boolean
): string {
  const currentIndex = getNoteIndex(note, accidental);
  if (currentIndex === -1) return note + (accidental || "");

  const newIndex = currentIndex + semitones;
  return getNoteAtIndex(newIndex, preferFlats);
}

/**
 * Parses a chord string into its components
 */
interface ChordParts {
  root: string;
  rootAccidental?: string;
  modifiers: string;
  bassNote?: string;
  bassAccidental?: string;
}

function parseChord(chord: string): ChordParts | null {
  const match = chord.match(CHORD_REGEX);
  if (!match) return null;

  return {
    root: match[1],
    rootAccidental: match[2],
    modifiers: match[3] || "",
    bassNote: match[4],
    bassAccidental: match[5],
  };
}

/**
 * Transposes a single chord by the given number of semitones
 *
 * @param chord - The chord to transpose (e.g., "Am7", "F#m", "C/G")
 * @param semitones - Number of semitones to transpose (positive = up, negative = down)
 * @param preferFlats - Whether to use flats instead of sharps
 * @returns The transposed chord
 */
export function transposeChord(
  chord: string,
  semitones: number,
  preferFlats: boolean = false
): string {
  if (semitones === 0) return chord;

  const parts = parseChord(chord);
  if (!parts) return chord; // Return unchanged if not a valid chord

  // Transpose root note
  const newRoot = transposeNote(
    parts.root,
    parts.rootAccidental,
    semitones,
    preferFlats
  );

  // Transpose bass note if present
  let newBass = "";
  if (parts.bassNote) {
    newBass =
      "/" +
      transposeNote(parts.bassNote, parts.bassAccidental, semitones, preferFlats);
  }

  return newRoot + parts.modifiers + newBass;
}

/**
 * Transposes all chords in a line of text
 *
 * @param line - A line of text containing chords
 * @param semitones - Number of semitones to transpose
 * @param preferFlats - Whether to use flats instead of sharps
 * @returns The line with all chords transposed
 */
export function transposeLine(
  line: string,
  semitones: number,
  preferFlats: boolean = false
): string {
  if (semitones === 0) return line;

  return line.replace(CHORD_IN_LINE_REGEX, (match) => {
    return transposeChord(match, semitones, preferFlats);
  });
}

/**
 * Transposes all chords in a multi-line chord sheet
 *
 * @param chords - Multi-line string of chords
 * @param semitones - Number of semitones to transpose
 * @param preferFlats - Whether to use flats instead of sharps
 * @returns The chord sheet with all chords transposed
 */
export function transposeChordSheet(
  chords: string,
  semitones: number,
  preferFlats: boolean = false
): string {
  if (semitones === 0 || !chords) return chords;

  return chords
    .split("\n")
    .map((line) => transposeLine(line, semitones, preferFlats))
    .join("\n");
}

/**
 * Transposes a key by the given number of semitones
 *
 * @param key - The original key (e.g., "C", "Am", "F# Major")
 * @param semitones - Number of semitones to transpose
 * @returns The transposed key
 */
export function transposeKey(key: string, semitones: number): string {
  if (semitones === 0 || !key) return key;

  // Parse the key to extract root and quality
  const keyMatch = key.match(/^([A-G])([#b])?\s*(m|min|minor|maj|major)?/i);
  if (!keyMatch) return key;

  const root = keyMatch[1];
  const accidental = keyMatch[2];
  const quality = keyMatch[3] || "";

  // Determine if result should use flats based on the new key
  const currentIndex = getNoteIndex(root, accidental);
  const newIndex = ((currentIndex + semitones) % 12 + 12) % 12;

  // Check if the new key is in flat keys
  const testNote = SHARP_NOTES[newIndex];
  const isMinor = quality.toLowerCase().startsWith("m");
  const testKey = isMinor ? testNote + "m" : testNote;
  const preferFlats = FLAT_KEYS.includes(testKey) || FLAT_KEYS.includes(FLAT_NOTES[newIndex] + (isMinor ? "m" : ""));

  const newRoot = transposeNote(root, accidental, semitones, preferFlats);

  // Preserve the original quality format
  if (quality) {
    return newRoot + " " + quality;
  }
  return newRoot;
}

/**
 * Calculates the number of semitones between two keys
 *
 * @param fromKey - The original key
 * @param toKey - The target key
 * @returns Number of semitones (positive = up, negative if > 6 semitones up)
 */
export function getSemitonesBetweenKeys(fromKey: string, toKey: string): number {
  const fromMatch = fromKey.match(/^([A-G])([#b])?/);
  const toMatch = toKey.match(/^([A-G])([#b])?/);

  if (!fromMatch || !toMatch) return 0;

  const fromIndex = getNoteIndex(fromMatch[1], fromMatch[2]);
  const toIndex = getNoteIndex(toMatch[1], toMatch[2]);

  if (fromIndex === -1 || toIndex === -1) return 0;

  let semitones = toIndex - fromIndex;

  // Normalize to -6 to +6 range (shortest distance)
  if (semitones > 6) semitones -= 12;
  if (semitones < -6) semitones += 12;

  return semitones;
}

/**
 * List of all standard keys for UI selection
 */
export const ALL_KEYS = [
  "C",
  "C#",
  "Db",
  "D",
  "D#",
  "Eb",
  "E",
  "F",
  "F#",
  "Gb",
  "G",
  "G#",
  "Ab",
  "A",
  "A#",
  "Bb",
  "B",
  "Cm",
  "C#m",
  "Dm",
  "D#m",
  "Ebm",
  "Em",
  "Fm",
  "F#m",
  "Gm",
  "G#m",
  "Abm",
  "Am",
  "A#m",
  "Bbm",
  "Bm",
];

/**
 * Formats a transposition value for display
 * @param semitones - The transposition in semitones
 * @returns Formatted string like "+2", "-3", or "0"
 */
export function formatTransposition(semitones: number): string {
  if (semitones === 0) return "0";
  return semitones > 0 ? `+${semitones}` : `${semitones}`;
}
