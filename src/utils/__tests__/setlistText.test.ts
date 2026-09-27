import { describe, expect, it } from "vitest";
import i18next from "i18next";
import es from "../../i18n/locales/es.json";
import { createTestI18n } from "../../test/i18n";
import type { SetlistItem } from "../../services/setlistsService";
import type { Song } from "../../services/songsService";
import {
  SETLIST_TEXT_DEFAULTS,
  formatClock,
  formatSetlistText,
  parseStoredExportOptions,
  setlistFileName,
  setlistTextDurations,
  type SetlistTextInput,
  type SetlistTextOptions,
  type Translate,
} from "../setlistText";

const en = createTestI18n();
const tEn: Translate = (key, options) => en.t(key, options);

function spanish(): Translate {
  const i18n = i18next.createInstance();
  void i18n.init({
    lng: "es",
    resources: { es: { translation: es } },
    interpolation: { escapeValue: false },
    initImmediate: false,
  });
  return (key, options) => i18n.t(key, options);
}

function song(id: string, title: string, extra: Partial<Song> = {}): Song {
  return { id, band_id: 1, user_id: "u1", title, created_at: "2026-01-01", artist: "Still Louder", ...extra };
}

const SONGS = [
  song("s1", "La Furia", { key: "Dm", tempo: 195, duration: 213 }),
  song("s2", "Karma", { key: "Em", duration: 270 }),
  song("s3", "Al Vacío", { key: "Bm", tempo: 220, duration: 246 }),
  song("s4", "Skirlaz", { key: "Cm", tempo: 163, duration: 246 }),
  song("s5", "A Las 10", { key: "Cm", tempo: 190, duration: 311 }),
  song("s6", "Mujer De Hielo", { key: "Gm", duration: 244 }),
];

const songItem = (song_id: string, position: number, notes?: string): SetlistItem => ({
  type: "song",
  song_id,
  position,
  notes,
});

/** Strato with a section, a 10-minute break and a note item. */
const ITEMS: SetlistItem[] = [
  { type: "section", id: "sec1", label: "Set 1", position: 0 },
  songItem("s1", 1),
  songItem("s2", 2),
  songItem("s3", 3),
  { type: "break", id: "brk1", label: "Break", duration: 10, position: 4 },
  songItem("s4", 5),
  songItem("s5", 6, "Count-in by drums"),
  { type: "note", id: "note1", label: "Switch to drop D", position: 7 },
  songItem("s6", 8),
];

function input(overrides: Partial<SetlistTextInput> = {}): SetlistTextInput {
  return {
    name: "Strato",
    items: ITEMS,
    songsById: new Map(SONGS.map((s) => [s.id, s])),
    ...overrides,
  };
}

function format(
  options: Partial<SetlistTextOptions> & Pick<SetlistTextOptions, "layout">,
  overrides: Partial<SetlistTextInput> = {},
  t: Translate = tEn,
  locale = "en",
): string {
  return formatSetlistText(input(overrides), { ...SETLIST_TEXT_DEFAULTS[options.layout], ...options }, t, locale);
}

describe("formatSetlistText layouts", () => {
  it("stage", () => {
    expect(format({ layout: "stage" })).toMatchInlineSnapshot(`
      "STRATO

      SET 1
       1  La Furia
       2  Karma
       3  Al Vacío
      — Break · 10 min —
       4  Skirlaz
       5  A Las 10
       6  Mujer De Hielo
      "
    `);
  });

  it("technical", () => {
    expect(format({ layout: "technical" })).toMatchInlineSnapshot(`
      "Strato — Still Louder
      6 songs · 25:30 of music · 35:30 total

      #  Song            Key  BPM  Dur.  Start
      Set 1 · 35:30
      1  La Furia        Dm   195  3:33   0:00
      2  Karma           Em     —  4:30   3:33
      3  Al Vacío        Bm   220  4:06   8:03
         Break · 10 min                  12:09
      4  Skirlaz         Cm   163  4:06  22:09
      5  A Las 10        Cm   190  5:11  26:15
         ↳ Count-in by drums
         Switch to drop D
      6  Mujer De Hielo  Gm     —  4:04  31:26
      "
    `);
  });

  it("message", () => {
    expect(format({ layout: "message" })).toMatchInlineSnapshot(`
      "*Strato* — Still Louder
      6 songs · 25:30 of music · 35:30 total

      *Set 1*
      1. La Furia (Dm · 195)
      2. Karma (Em)
      3. Al Vacío (Bm · 220)
      — Break · 10 min —
      4. Skirlaz (Cm · 163)
      5. A Las 10 (Cm · 190)
         _Count-in by drums_
      _Switch to drop D_
      6. Mujer De Hielo (Gm)
      "
    `);
  });

  it("technical in Spanish has no English labels", () => {
    expect(format({ layout: "technical" }, {}, spanish(), "es")).toMatchInlineSnapshot(`
      "Strato — Still Louder
      6 canciones · 25:30 de música · 35:30 en total

      #  Canción         Tono  BPM  Dur.  Inicio
      Set 1 · 35:30
      1  La Furia        Dm    195  3:33    0:00
      2  Karma           Em      —  4:30    3:33
      3  Al Vacío        Bm    220  4:06    8:03
         Break · 10 min                    12:09
      4  Skirlaz         Cm    163  4:06   22:09
      5  A Las 10        Cm    190  5:11   26:15
         ↳ Count-in by drums
         Switch to drop D
      6  Mujer De Hielo  Gm      —  4:04   31:26
      "
    `);
  });
});

describe("formatSetlistText content", () => {
  it("drops sections and breaks when specialItems is off, keeps numbering", () => {
    const text = format({ layout: "message", specialItems: false, notes: false });
    expect(text).not.toContain("Set 1");
    expect(text).not.toContain("Break");
    expect(text).not.toContain("drop D");
    expect(text).toContain("4. Skirlaz");
  });

  it("note items and song notes follow the notes option", () => {
    const text = format({ layout: "stage", notes: true });
    expect(text).toContain("Count-in by drums");
    expect(text).toContain("Switch to drop D");
    expect(format({ layout: "stage", notes: false })).not.toContain("drop D");
  });

  it("hoists a shared artist to the header only", () => {
    const text = format({ layout: "message" });
    expect(text.split("Still Louder")).toHaveLength(2);
  });

  it("prints the artist per song when one differs", () => {
    const songs = [...SONGS.slice(0, 5), { ...SONGS[5], artist: "Soda Stereo" }];
    const text = format({ layout: "message", key: false, tempo: false }, { songsById: new Map(songs.map((s) => [s.id, s])) });
    expect(text.split("\n")[0]).toBe("*Strato*");
    expect(text).toContain("1. La Furia (Still Louder)");
    expect(text).toContain("6. Mujer De Hielo (Soda Stereo)");
  });

  it("does not hoist when a song has no artist", () => {
    const songs = [...SONGS.slice(0, 5), { ...SONGS[5], artist: undefined }];
    const text = format({ layout: "technical" }, { songsById: new Map(songs.map((s) => [s.id, s])) });
    expect(text.split("\n")[0]).toBe("Strato");
    expect(text).toContain("Artist");
    expect(text).toMatch(/Mujer De Hielo\s+—\s+Gm/);
  });

  it("skips songs that no longer exist and keeps numbering continuous", () => {
    const songs = SONGS.filter((s) => s.id !== "s2");
    const text = format({ layout: "message", specialItems: false }, { songsById: new Map(songs.map((s) => [s.id, s])) });
    expect(text).toContain("2. Al Vacío");
    expect(text).toContain("5. Mujer De Hielo");
    expect(text).toContain("5 songs");
  });

  it("prints unknown start times after a song without a duration", () => {
    const songs = SONGS.map((s) => (s.id === "s2" ? { ...s, duration: undefined } : s));
    const lines = format({ layout: "technical" }, { songsById: new Map(songs.map((s) => [s.id, s])) }).split("\n");
    expect(lines.find((l) => l.includes("Karma"))).toMatch(/—\s+3:33$/);
    expect(lines.find((l) => l.includes("Al Vacío"))).toMatch(/—$/);
    expect(lines.find((l) => l.includes("Mujer De Hielo"))).toMatch(/—$/);
  });

  it("shows one duration when there are no timed breaks", () => {
    const items = ITEMS.filter((item) => item.type !== "break");
    expect(format({ layout: "message" }, { items })).toContain("6 songs · 25:30\n");
  });

  it("omits the duration when no song has one", () => {
    const songs = SONGS.map((s) => ({ ...s, duration: undefined }));
    const items = ITEMS.filter((item) => item.type !== "break");
    const text = format({ layout: "message" }, { items, songsById: new Map(songs.map((s) => [s.id, s])) });
    expect(text).toContain("6 songs\n");
  });

  it("uses h:mm:ss for an hour or more", () => {
    const songs = SONGS.map((s) => ({ ...s, duration: 700 }));
    const items = ITEMS.filter((item) => item.type !== "break");
    expect(format({ layout: "message" }, { items, songsById: new Map(songs.map((s) => [s.id, s])) })).toContain(
      "6 songs · 1:10:00",
    );
  });

  it("adds description and show when enabled", () => {
    const text = format(
      { layout: "technical", description: true, show: true },
      {
        description: "Summer tour",
        show: { name: "Fiesta", event_date: "2026-10-03", event_time: "21:30:00", venue: "La Rana Dorada" },
      },
    );
    const lines = text.split("\n");
    expect(lines[1]).toBe("Fiesta · Saturday, October 3, 2026 · 21:30 · La Rana Dorada");
    expect(lines[2]).toBe("Summer tour");
  });

  it("returns only the header for an empty setlist", () => {
    expect(format({ layout: "technical" }, { items: [] })).toBe("Strato\n0 songs\n");
  });

  it("ends with exactly one newline and no trailing spaces", () => {
    for (const layout of ["stage", "technical", "message"] as const) {
      const text = format({ layout });
      expect(text.endsWith("\n")).toBe(true);
      expect(text.endsWith("\n\n")).toBe(false);
      expect(text.split("\n").every((line) => line === line.trimEnd())).toBe(true);
    }
  });
});

describe("setlistTextDurations", () => {
  it("adds break minutes to the total only", () => {
    expect(setlistTextDurations(ITEMS, new Map(SONGS.map((s) => [s.id, s])))).toEqual({
      musicSeconds: 1530,
      totalSeconds: 2130,
    });
  });
});

describe("formatClock", () => {
  it.each([
    [0, "0:00"],
    [59, "0:59"],
    [213, "3:33"],
    [3599, "59:59"],
    [3600, "1:00:00"],
    [4200, "1:10:00"],
  ])("%i → %s", (seconds, expected) => {
    expect(formatClock(seconds)).toBe(expected);
  });
});

describe("setlistFileName", () => {
  it.each([
    ["Al Vacío", "al-vacio.txt"],
    ["Strato", "strato.txt"],
    ["  Fiesta de Año Nuevo 2026! ", "fiesta-de-ano-nuevo-2026.txt"],
    ["¡¿?!", "setlist.txt"],
    ["", "setlist.txt"],
  ])("%j → %s", (name, expected) => {
    expect(setlistFileName(name)).toBe(expected);
  });
});

describe("parseStoredExportOptions", () => {
  it("falls back to technical defaults for missing or invalid JSON", () => {
    expect(parseStoredExportOptions(null)).toEqual(SETLIST_TEXT_DEFAULTS.technical);
    expect(parseStoredExportOptions("{nope")).toEqual(SETLIST_TEXT_DEFAULTS.technical);
    expect(parseStoredExportOptions("42")).toEqual(SETLIST_TEXT_DEFAULTS.technical);
  });

  it("falls back to technical for an unknown layout", () => {
    expect(parseStoredExportOptions(JSON.stringify({ layout: "poster" })).layout).toBe("technical");
  });

  it("fills missing fields from the layout and ignores wrong types", () => {
    const options = parseStoredExportOptions(JSON.stringify({ layout: "message", duration: true, key: "yes" }));
    expect(options).toEqual({ ...SETLIST_TEXT_DEFAULTS.message, duration: true });
  });
});
