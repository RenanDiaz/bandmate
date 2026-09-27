import type { SetlistItem, SetlistSongItem } from "../services/setlistsService";
import type { Song } from "../services/songsService";

/**
 * Plain-text export of a setlist (spec: docs/specs/setlist-text-export.md).
 *
 * Pure: no React, no `window`, no service calls. The preview, Copy, Download
 * and Share all consume the string `formatSetlistText` returns. Types only are
 * imported from the services so this module never loads the Supabase client.
 */

export type SetlistTextLayout = "stage" | "technical" | "message";

export interface SetlistTextOptions {
  layout: SetlistTextLayout;
  description: boolean;
  show: boolean;
  songCount: boolean;
  totalDuration: boolean;
  artist: boolean;
  key: boolean;
  tempo: boolean;
  duration: boolean;
  /** Cumulative start time per row; `technical` only, ignored elsewhere. */
  startTime: boolean;
  /** Song notes and note items. */
  notes: boolean;
  /** Sections and breaks. */
  specialItems: boolean;
}

export interface SetlistTextShow {
  name: string;
  /** YYYY-MM-DD */
  event_date: string;
  event_time?: string;
  venue?: string;
}

export interface SetlistTextInput {
  name: string;
  description?: string;
  items: SetlistItem[];
  songsById: ReadonlyMap<string, Song>;
  show?: SetlistTextShow;
}

export type Translate = (key: string, options?: Record<string, unknown>) => string;

const LAYOUTS: readonly SetlistTextLayout[] = ["stage", "technical", "message"];

const ALL_OFF: Omit<SetlistTextOptions, "layout"> = {
  description: false,
  show: false,
  songCount: false,
  totalDuration: false,
  artist: false,
  key: false,
  tempo: false,
  duration: false,
  startTime: false,
  notes: false,
  specialItems: false,
};

type OptionFlag = keyof typeof ALL_OFF;
const OPTION_FLAGS = Object.keys(ALL_OFF) as OptionFlag[];

export const SETLIST_TEXT_DEFAULTS: Record<SetlistTextLayout, SetlistTextOptions> = {
  stage: { ...ALL_OFF, layout: "stage", specialItems: true },
  technical: {
    layout: "technical",
    description: true,
    show: true,
    songCount: true,
    totalDuration: true,
    artist: true,
    key: true,
    tempo: true,
    duration: true,
    startTime: true,
    notes: true,
    specialItems: true,
  },
  message: {
    ...ALL_OFF,
    layout: "message",
    songCount: true,
    totalDuration: true,
    artist: true,
    key: true,
    tempo: true,
    notes: true,
    specialItems: true,
  },
};

const TEXT = "setlists.export.text";
const EMPTY_CELL = "—";
const GAP = "  ";

// Legacy rows have no `type`; same rule as `isSongItem` in setlistsService.
function isSong(item: SetlistItem): item is SetlistSongItem {
  return item.type === "song" || (!item.type && "song_id" in item);
}

/** "h:mm:ss" at or over an hour, else "m:ss". */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** Seconds of music and seconds including breaks. */
export function setlistTextDurations(
  items: SetlistItem[],
  songsById: ReadonlyMap<string, Song>,
): { musicSeconds: number; totalSeconds: number } {
  let musicSeconds = 0;
  let breakSeconds = 0;
  for (const item of items) {
    if (isSong(item)) musicSeconds += songsById.get(item.song_id)?.duration || 0;
    else if (item.type === "break") breakSeconds += (item.duration || 0) * 60;
  }
  return { musicSeconds, totalSeconds: musicSeconds + breakSeconds };
}

/** NFD, strip marks, lowercase, non-alphanumerics → "-", trimmed; "setlist" when empty. */
export function setlistFileName(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "setlist"}.txt`;
}

/** Parse stored options; anything invalid falls back to the layout's defaults. */
export function parseStoredExportOptions(raw: string | null): SetlistTextOptions {
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  const record = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const layout = LAYOUTS.includes(record.layout as SetlistTextLayout)
    ? (record.layout as SetlistTextLayout)
    : "technical";
  const options: SetlistTextOptions = { ...SETLIST_TEXT_DEFAULTS[layout] };
  for (const flag of OPTION_FLAGS) {
    if (typeof record[flag] === "boolean") options[flag] = record[flag] as boolean;
  }
  return options;
}

// ============================================
// Rows
// ============================================

type Row =
  | { kind: "song"; number: number; song: Song; notes?: string; start: number | null }
  | { kind: "section"; label: string; seconds: number }
  | { kind: "break"; label: string; minutes?: number; start: number | null }
  | { kind: "note"; label: string };

function buildRows(input: SetlistTextInput, options: SetlistTextOptions, t: Translate): Row[] {
  const rows: Row[] = [];
  let number = 0;
  // Cumulative start; null once a song without a duration has been passed.
  let start: number | null = 0;
  let section: { label: string; seconds: number } | null = null;

  for (const item of input.items) {
    if (isSong(item)) {
      const song = input.songsById.get(item.song_id);
      if (!song) continue;
      number += 1;
      rows.push({ kind: "song", number, song, notes: item.notes?.trim() || undefined, start });
      if (section) section.seconds += song.duration || 0;
      start = start !== null && song.duration ? start + song.duration : null;
    } else if (item.type === "break") {
      const seconds = (item.duration || 0) * 60;
      if (options.specialItems) {
        rows.push({
          kind: "break",
          label: item.label?.trim() || t(`${TEXT}.break`),
          minutes: item.duration || undefined,
          start,
        });
      }
      if (section) section.seconds += seconds;
      if (start !== null) start += seconds;
    } else if (item.type === "section") {
      section = null;
      if (options.specialItems) {
        const row = { kind: "section" as const, label: item.label?.trim() ?? "", seconds: 0 };
        rows.push(row);
        section = row;
      }
    } else if (item.type === "note") {
      if (options.notes && item.label?.trim()) rows.push({ kind: "note", label: item.label.trim() });
    }
  }
  return rows;
}

/** Artist printed once in the header: every song has one and they are all equal. */
function hoistedArtist(rows: Row[]): string | undefined {
  const artists = rows.flatMap((row) => (row.kind === "song" ? [row.song.artist?.trim() ?? ""] : []));
  if (artists.length === 0 || artists.some((a) => !a)) return undefined;
  return artists.every((a) => a === artists[0]) ? artists[0] : undefined;
}

function breakText(row: Extract<Row, { kind: "break" }>, t: Translate): string {
  return row.minutes
    ? `${row.label} · ${t(`${TEXT}.breakMinutes`, { minutes: row.minutes })}`
    : row.label;
}

// ============================================
// Header
// ============================================

function headerLines(
  input: SetlistTextInput,
  options: SetlistTextOptions,
  rows: Row[],
  artist: string | undefined,
  t: Translate,
  locale: string,
): string[] {
  const lines: string[] = [];
  const name =
    options.layout === "stage"
      ? input.name.toLocaleUpperCase(locale)
      : options.layout === "message"
        ? `*${input.name}*`
        : input.name;
  lines.push(artist ? `${name} — ${artist}` : name);

  if (options.show && input.show) {
    const { show } = input;
    const date = new Date(`${show.event_date}T00:00:00`);
    const parts = [
      show.name,
      Number.isNaN(date.getTime())
        ? show.event_date
        : date.toLocaleDateString(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
      show.event_time?.slice(0, 5),
      show.venue,
    ].filter((part): part is string => Boolean(part?.trim()));
    lines.push(parts.join(" · "));
  }

  if (options.description && input.description?.trim()) lines.push(input.description.trim());

  const summary: string[] = [];
  if (options.songCount) {
    const count = rows.filter((row) => row.kind === "song").length;
    summary.push(t(`${TEXT}.songs`, { count }));
  }
  if (options.totalDuration) {
    const { musicSeconds, totalSeconds } = setlistTextDurations(input.items, input.songsById);
    if (totalSeconds > musicSeconds) {
      if (musicSeconds > 0) summary.push(t(`${TEXT}.music`, { duration: formatClock(musicSeconds) }));
      summary.push(t(`${TEXT}.total`, { duration: formatClock(totalSeconds) }));
    } else if (musicSeconds > 0) {
      summary.push(formatClock(musicSeconds));
    }
  }
  if (summary.length > 0) lines.push(summary.join(" · "));
  return lines;
}

// ============================================
// Layouts
// ============================================

function songDetails(row: Extract<Row, { kind: "song" }>, options: SetlistTextOptions, hoisted: boolean): string[] {
  const { song } = row;
  const details: string[] = [];
  if (options.artist && !hoisted && song.artist?.trim()) details.push(song.artist.trim());
  if (options.key && song.key) details.push(song.key);
  if (options.tempo && song.tempo) details.push(String(song.tempo));
  if (options.duration && song.duration) details.push(formatClock(song.duration));
  return details;
}

function numberWidth(rows: Row[]): number {
  const songs = rows.filter((row) => row.kind === "song").length;
  return Math.max(2, String(songs).length);
}

/** Blank line before a section, except at the top of the body. */
function pushSectionGap(lines: string[]): void {
  if (lines.length > 0) lines.push("");
}

function stageBody(rows: Row[], options: SetlistTextOptions, hoisted: boolean, t: Translate, locale: string): string[] {
  const width = numberWidth(rows);
  const indent = " ".repeat(width + GAP.length);
  const lines: string[] = [];
  for (const row of rows) {
    if (row.kind === "song") {
      const details = songDetails(row, options, hoisted);
      lines.push([`${String(row.number).padStart(width)}`, row.song.title, ...details].join(GAP));
      if (options.notes && row.notes) lines.push(`${indent}${row.notes}`);
    } else if (row.kind === "section") {
      pushSectionGap(lines);
      lines.push(row.label.toLocaleUpperCase(locale));
    } else if (row.kind === "break") {
      lines.push(`— ${breakText(row, t)} —`);
    } else {
      lines.push(`${indent}${row.label}`);
    }
  }
  return lines;
}

function messageBody(rows: Row[], options: SetlistTextOptions, hoisted: boolean, t: Translate): string[] {
  const lines: string[] = [];
  for (const row of rows) {
    if (row.kind === "song") {
      const details = songDetails(row, options, hoisted);
      lines.push(`${row.number}. ${row.song.title}${details.length ? ` (${details.join(" · ")})` : ""}`);
      if (options.notes && row.notes) lines.push(`   _${row.notes}_`);
    } else if (row.kind === "section") {
      pushSectionGap(lines);
      lines.push(`*${row.label}*`);
    } else if (row.kind === "break") {
      lines.push(`— ${breakText(row, t)} —`);
    } else {
      lines.push(`_${row.label}_`);
    }
  }
  return lines;
}

/** Display width: code points of the NFC form (wide characters and emoji may misalign). */
function textWidth(text: string): number {
  return [...text.normalize("NFC")].length;
}

function padEnd(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - textWidth(text)));
}

function padStart(text: string, width: number): string {
  return " ".repeat(Math.max(0, width - textWidth(text))) + text;
}

interface Column {
  header: string;
  align: "left" | "right";
  cell: (row: Extract<Row, { kind: "song" }>) => string;
}

function technicalBody(rows: Row[], options: SetlistTextOptions, hoisted: boolean, t: Translate): string[] {
  const songs = rows.filter((row): row is Extract<Row, { kind: "song" }> => row.kind === "song");
  const clockOrEmpty = (seconds: number | null | undefined) =>
    seconds === null || seconds === undefined ? EMPTY_CELL : formatClock(seconds);

  const columns: Column[] = [
    { header: t(`${TEXT}.colNumber`), align: "right", cell: (row) => String(row.number) },
    { header: t(`${TEXT}.colSong`), align: "left", cell: (row) => row.song.title },
  ];
  if (options.artist && !hoisted) {
    columns.push({ header: t(`${TEXT}.colArtist`), align: "left", cell: (row) => row.song.artist?.trim() || EMPTY_CELL });
  }
  if (options.key) columns.push({ header: t(`${TEXT}.colKey`), align: "left", cell: (row) => row.song.key || EMPTY_CELL });
  if (options.tempo) {
    columns.push({ header: t(`${TEXT}.colBpm`), align: "right", cell: (row) => (row.song.tempo ? String(row.song.tempo) : EMPTY_CELL) });
  }
  if (options.duration) {
    columns.push({ header: t(`${TEXT}.colDuration`), align: "right", cell: (row) => clockOrEmpty(row.song.duration || null) });
  }
  if (options.startTime) columns.push({ header: t(`${TEXT}.colStart`), align: "right", cell: (row) => clockOrEmpty(row.start) });

  const breakStarts = rows.flatMap((row) => (row.kind === "break" ? [clockOrEmpty(row.start)] : []));
  const widths = columns.map((column, index) =>
    Math.max(
      textWidth(column.header),
      ...songs.map((row) => textWidth(column.cell(row))),
      ...(options.startTime && index === columns.length - 1 ? breakStarts.map(textWidth) : []),
    ),
  );
  const line = (cells: string[]) =>
    cells
      .map((cell, index) => (columns[index].align === "right" ? padStart(cell, widths[index]) : padEnd(cell, widths[index])))
      .join(GAP)
      .trimEnd();

  const indent = " ".repeat(widths[0] + GAP.length);
  // Width of everything left of the start column, so a break's start lines up with the songs'.
  const beforeStart = options.startTime
    ? widths.slice(0, -1).reduce((sum, width) => sum + width, 0) + GAP.length * (widths.length - 2)
    : 0;

  const lines: string[] = [];
  if (songs.length > 0) lines.push(line(columns.map((column) => column.header)));
  for (const row of rows) {
    if (row.kind === "song") {
      lines.push(line(columns.map((column) => column.cell(row))));
      if (options.notes && row.notes) lines.push(`${indent}↳ ${row.notes}`);
    } else if (row.kind === "section") {
      if (lines.length > 1) lines.push("");
      const subtotal = options.duration && row.seconds > 0 ? ` · ${formatClock(row.seconds)}` : "";
      lines.push(`${row.label}${subtotal}`);
    } else if (row.kind === "break") {
      const text = `${indent}${breakText(row, t)}`;
      lines.push(
        options.startTime
          ? `${padEnd(text, beforeStart)}${GAP}${padStart(clockOrEmpty(row.start), widths[widths.length - 1])}`
          : text,
      );
    } else {
      lines.push(`${indent}${row.label}`);
    }
  }
  return lines;
}

// ============================================
// Entry point
// ============================================

export function formatSetlistText(
  input: SetlistTextInput,
  options: SetlistTextOptions,
  t: Translate,
  locale: string,
): string {
  const rows = buildRows(input, options, t);
  const artist = options.artist ? hoistedArtist(rows) : undefined;
  const hoisted = artist !== undefined;
  const header = headerLines(input, options, rows, artist, t, locale);

  const body =
    options.layout === "stage"
      ? stageBody(rows, options, hoisted, t, locale)
      : options.layout === "message"
        ? messageBody(rows, options, hoisted, t)
        : technicalBody(rows, options, hoisted, t);

  const lines = body.length > 0 ? [...header, "", ...body] : header;
  return `${lines.map((l) => l.trimEnd()).join("\n").trimEnd()}\n`;
}
