import { describe, expect, it } from "vitest";
import type { SetlistItem } from "../../services/setlistsService";
import type { Song } from "../../services/songsService";
import { normalizeTargetMinutes, planProgress, sectionSubtotals } from "../setlistPlan";
import { formatSetlistText, setlistTextDurations, SETLIST_TEXT_DEFAULTS } from "../setlistText";

const song = (id: string, duration?: number): Song =>
  ({ id, title: `Song ${id}`, artist: "Band", duration }) as Song;

const songsById = new Map<string, Song>([
  ["a", song("a", 240)],
  ["b", song("b", 200)],
  ["c", song("c", 300)],
  ["n", song("n")], // no duration
]);

const s = (song_id: string): SetlistItem => ({ type: "song", song_id, position: 0 });
const section = (id: string, label = id): SetlistItem => ({ type: "section", id, label, position: 0 });
const brk = (minutes?: number, id = "brk"): SetlistItem => ({ type: "break", id, label: "Break", duration: minutes, position: 0 });
const note = (): SetlistItem => ({ type: "note", id: "note", label: "Tune down", position: 0 });

describe("planProgress", () => {
  const items = [s("a"), s("b"), brk(15), s("c"), note()];

  it("counts songs, music and music + breaks", () => {
    expect(planProgress(items, songsById)).toEqual({ songCount: 3, musicSeconds: 740, totalSeconds: 740 + 900 });
  });

  it("adds target and ratio under the target", () => {
    const p = planProgress(items, songsById, 60);
    expect(p.targetSeconds).toBe(3600);
    expect(p.ratio).toBeCloseTo(1640 / 3600);
    expect(p.overBySeconds).toBeUndefined();
  });

  it("reports how far over the target it is", () => {
    const p = planProgress(items, songsById, 25);
    expect(p.overBySeconds).toBe(1640 - 1500);
    expect(p.ratio).toBeGreaterThan(1);
  });

  it("ignores an empty, zero or invalid target", () => {
    for (const target of [null, undefined, 0, -5, Number.NaN]) {
      expect(planProgress(items, songsById, target).targetSeconds).toBeUndefined();
    }
  });

  it("treats songs without a duration (or unknown songs) as zero", () => {
    expect(planProgress([s("n"), s("missing")], songsById)).toMatchObject({ songCount: 2, musicSeconds: 0, totalSeconds: 0 });
  });

  it("is what the text export's durations use", () => {
    const { musicSeconds, totalSeconds } = planProgress(items, songsById);
    expect(setlistTextDurations(items, songsById)).toEqual({ musicSeconds, totalSeconds });
  });
});

describe("normalizeTargetMinutes", () => {
  it("rounds and keeps positive numbers only", () => {
    expect(normalizeTargetMinutes(60)).toBe(60);
    expect(normalizeTargetMinutes(44.6)).toBe(45);
    expect(normalizeTargetMinutes(0)).toBeNull();
    expect(normalizeTargetMinutes("60")).toBeNull();
    expect(normalizeTargetMinutes(Infinity)).toBeNull();
  });
});

describe("sectionSubtotals", () => {
  it("sums songs and breaks up to the next section; items before the first section belong to none", () => {
    const items = [s("n"), section("s1"), s("a"), brk(15), s("b"), section("s2"), s("c"), note()];
    expect([...sectionSubtotals(items, songsById)]).toEqual([
      ["s1", 240 + 900 + 200],
      ["s2", 300],
    ]);
  });

  it("keeps empty sections at zero", () => {
    expect([...sectionSubtotals([section("s1"), section("s2"), s("a")], songsById)]).toEqual([
      ["s1", 0],
      ["s2", 240],
    ]);
  });

  it("matches the technical text export's section subtotals", () => {
    const items = [section("s1", "Set 1"), s("a"), s("b"), brk(10), section("s2", "Set 2"), s("c")];
    const text = formatSetlistText(
      { name: "Gig", items, songsById },
      SETLIST_TEXT_DEFAULTS.technical,
      (key, options) => (options ? `${key} ${JSON.stringify(options)}` : key),
      "en",
    );
    const subtotals = sectionSubtotals(items, songsById);
    // 240 + 200 + 600 = 1040 s = 17:20; 300 s = 5:00
    expect(subtotals.get("s1")).toBe(1040);
    expect(subtotals.get("s2")).toBe(300);
    expect(text).toContain("Set 1 · 17:20");
    expect(text).toContain("Set 2 · 5:00");
  });
});
