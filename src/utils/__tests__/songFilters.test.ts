import { describe, expect, it } from "vitest";
import type { Song } from "../../services/songsService";
import type { SongSignals } from "../songSignals";
import {
  DEFAULT_PICKER_STATE,
  EMPTY_PICKER_FILTERS,
  energyBand,
  filterByPicker,
  filterBySearch,
  hasActivePickerFilters,
  parseStoredPickerState,
  pickerFacets,
  sortForPicker,
  type PickerFilters,
} from "../songFilters";

function song(id: string, title: string, extra: Partial<Song> = {}): Song {
  return { id, band_id: 1, user_id: "u1", title, created_at: "2026-01-01T00:00:00Z", ...extra };
}

const SONGS = [
  song("a", "Alpha", { tags: ["rock", "opener"], key: "Dm", language: "es", energy: 0.9 }),
  song("b", "Bravo", { tags: ["ballad"], key: "C", language: "en", energy: 0.2 }),
  song("c", "Charlie", { tags: ["rock"], key: "Dm", language: "en", energy: 0.5 }),
  song("d", "Delta"),
];

const signal = (songId: string, timesPlayed: number, lastPlayedAt?: string): SongSignals => ({
  songId,
  timesPlayed,
  timesInSetlists: timesPlayed,
  lastPlayedAt,
});

const SIGNALS = new Map<string, SongSignals>([
  ["a", signal("a", 5, "2026-09-01")],
  ["b", signal("b", 2, "2025-01-10")],
  ["c", signal("c", 0)],
  ["d", signal("d", 0)],
]);

const TODAY = "2026-09-27";
const ids = (songs: Song[]) => songs.map((s) => s.id);
const filters = (overrides: Partial<PickerFilters>): PickerFilters => ({ ...EMPTY_PICKER_FILTERS, ...overrides });

describe("filterBySearch", () => {
  it("matches title, artist and tags", () => {
    expect(ids(filterBySearch(SONGS, "ballad"))).toEqual(["b"]);
    expect(ids(filterBySearch(SONGS, "  alp "))).toEqual(["a"]);
  });
});

describe("energyBand", () => {
  it("uses < 0.4 / 0.4–0.7 / ≥ 0.7", () => {
    expect(energyBand(0)).toBe("low");
    expect(energyBand(0.399)).toBe("low");
    expect(energyBand(0.4)).toBe("medium");
    expect(energyBand(0.699)).toBe("medium");
    expect(energyBand(0.7)).toBe("high");
    expect(energyBand(1)).toBe("high");
  });

  it("is undefined without a number", () => {
    expect(energyBand(undefined)).toBeUndefined();
    expect(energyBand(null)).toBeUndefined();
    expect(energyBand(Number.NaN)).toBeUndefined();
  });
});

describe("filterByPicker", () => {
  it("matches everything with empty filters", () => {
    expect(ids(filterByPicker(SONGS, EMPTY_PICKER_FILTERS, SIGNALS, TODAY))).toEqual(["a", "b", "c", "d"]);
  });

  it("ORs values within a filter", () => {
    expect(ids(filterByPicker(SONGS, filters({ tags: ["ballad", "opener"] }), SIGNALS, TODAY))).toEqual(["a", "b"]);
    expect(ids(filterByPicker(SONGS, filters({ energy: ["low", "high"] }), SIGNALS, TODAY))).toEqual(["a", "b"]);
  });

  it("ANDs across filters", () => {
    expect(ids(filterByPicker(SONGS, filters({ tags: ["rock"], languages: ["en"] }), SIGNALS, TODAY))).toEqual(["c"]);
    expect(ids(filterByPicker(SONGS, filters({ keys: ["Dm"], energy: ["medium"] }), SIGNALS, TODAY))).toEqual(["c"]);
  });

  it("excludes songs without the value when a filter is set", () => {
    expect(ids(filterByPicker(SONGS, filters({ keys: ["Dm", "C"] }), SIGNALS, TODAY))).toEqual(["a", "b", "c"]);
  });

  it("filters by played status: never is exactly timesPlayed === 0", () => {
    expect(ids(filterByPicker(SONGS, filters({ played: ["never"] }), SIGNALS, TODAY))).toEqual(["c", "d"]);
    expect(ids(filterByPicker(SONGS, filters({ played: ["stale"] }), SIGNALS, TODAY))).toEqual(["b"]);
    expect(ids(filterByPicker(SONGS, filters({ played: ["played"] }), SIGNALS, TODAY))).toEqual(["a"]);
  });

  it("treats a song without signals as never played", () => {
    expect(ids(filterByPicker(SONGS, filters({ played: ["never"] }), new Map(), TODAY))).toEqual(["a", "b", "c", "d"]);
  });
});

describe("hasActivePickerFilters", () => {
  it("is true when any filter has a value", () => {
    expect(hasActivePickerFilters(EMPTY_PICKER_FILTERS)).toBe(false);
    expect(hasActivePickerFilters(filters({ played: ["never"] }))).toBe(true);
  });
});

describe("sortForPicker", () => {
  it("most_played: most first, ties by title", () => {
    const tie = [song("z", "Zulu"), ...SONGS];
    const signals = new Map(SIGNALS).set("z", signal("z", 2, "2026-01-01"));
    expect(ids(sortForPicker(tie, "most_played", signals))).toEqual(["a", "b", "z", "c", "d"]);
  });

  it("longest_since_played: never first (by title), then oldest last played", () => {
    expect(ids(sortForPicker(SONGS, "longest_since_played", SIGNALS))).toEqual(["c", "d", "b", "a"]);
  });

  it("keeps the existing sorts", () => {
    const withArtists = [song("x", "B", { artist: "Zed" }), song("y", "A", { artist: "Abe" }), song("w", "C", { artist: "Abe" })];
    expect(ids(sortForPicker(withArtists, "artist_title_asc", SIGNALS))).toEqual(["y", "w", "x"]);
    expect(ids(sortForPicker(withArtists, "title_asc", SIGNALS))).toEqual(["y", "x", "w"]);
  });

  it("does not mutate its input", () => {
    const input = [...SONGS];
    sortForPicker(input, "longest_since_played", SIGNALS);
    expect(ids(input)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("pickerFacets", () => {
  it("lists distinct, trimmed, sorted values", () => {
    const facets = pickerFacets([...SONGS, song("e", "Echo", { tags: [" rock "], key: " C ", language: "" })]);
    expect(facets).toEqual({
      tags: ["ballad", "opener", "rock"],
      keys: ["C", "Dm"],
      languages: ["en", "es"],
      hasEnergy: true,
    });
  });

  it("reports no energy when no song has it", () => {
    expect(pickerFacets([song("d", "Delta")]).hasEnergy).toBe(false);
  });

  it("matches trimmed catalog values in the filters", () => {
    const padded = [song("e", "Echo", { tags: [" rock "], key: " C " })];
    expect(ids(filterByPicker(padded, filters({ tags: ["rock"], keys: ["C"] }), SIGNALS, TODAY))).toEqual(["e"]);
  });
});

describe("parseStoredPickerState", () => {
  it("falls back to defaults for null, invalid JSON and non-objects", () => {
    expect(parseStoredPickerState(null)).toEqual(DEFAULT_PICKER_STATE);
    expect(parseStoredPickerState("{nope")).toEqual(DEFAULT_PICKER_STATE);
    expect(parseStoredPickerState("[]")).toEqual(DEFAULT_PICKER_STATE);
    expect(parseStoredPickerState("42")).toEqual(DEFAULT_PICKER_STATE);
  });

  it("keeps valid fields and drops invalid ones, field by field", () => {
    const raw = JSON.stringify({
      filters: { tags: ["rock", 3, "", "rock"], keys: "Dm", energy: ["high", "extreme"], played: ["never", "sometimes"] },
      sort: "most_played",
    });
    expect(parseStoredPickerState(raw)).toEqual({
      filters: { tags: ["rock"], keys: [], languages: [], energy: ["high"], played: ["never"] },
      sort: "most_played",
    });
  });

  it("replaces an unknown sort", () => {
    expect(parseStoredPickerState(JSON.stringify({ sort: "tempo_asc" })).sort).toBe("artist_title_asc");
  });

  it("round-trips a stored state", () => {
    const state = { filters: filters({ languages: ["es"], played: ["stale"] }), sort: "longest_since_played" as const };
    expect(parseStoredPickerState(JSON.stringify(state))).toEqual(state);
  });
});
