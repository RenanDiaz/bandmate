import { describe, expect, it } from "vitest";
import type { SetlistItem } from "../../services/setlistsService";
import { computeSongSignals, playedStatus, type SongSignals, type SongSignalsInput } from "../songSignals";

const songItem = (song_id: string, position = 0): SetlistItem => ({ type: "song", song_id, position });

type SetlistRow = SongSignalsInput["setlists"][number];
type ShowRow = SongSignalsInput["shows"][number];

const setlist = (id: string, songIds: string[], extra: Partial<SetlistRow> = {}): SetlistRow => ({
  id,
  songs: [{ type: "section", id: `${id}-sec`, label: "Set", position: 0 }, ...songIds.map((s, i) => songItem(s, i + 1))],
  is_draft: false,
  updated_at: "2026-01-01T00:00:00Z",
  ...extra,
});

const show = (id: string, setlist_id: string | null, event_date: string, extra: Partial<ShowRow> = {}): ShowRow => ({
  id,
  name: `Show ${id}`,
  venue: `Venue ${id}`,
  setlist_id,
  event_date,
  status: "completed",
  ...extra,
});

const songs = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("computeSongSignals", () => {
  it("returns one entry per song, in order, zeroed for a song in no setlist", () => {
    const signals = computeSongSignals({ songs, setlists: [], shows: [] });
    expect([...signals.keys()]).toEqual(["a", "b", "c"]);
    expect(signals.get("c")).toEqual({ songId: "c", timesPlayed: 0, timesInSetlists: 0 });
  });

  it("counts non-draft setlists only, keeping the latest updated_at", () => {
    const signals = computeSongSignals({
      songs,
      setlists: [
        setlist("s1", ["a", "b"], { updated_at: "2026-02-01T00:00:00Z" }),
        setlist("s2", ["a"], { updated_at: "2026-03-01T00:00:00Z" }),
        setlist("draft", ["a", "b"], { is_draft: true, updated_at: "2026-09-01T00:00:00Z" }),
      ],
      shows: [],
    });
    expect(signals.get("a")).toMatchObject({ timesInSetlists: 2, lastInSetlistAt: "2026-03-01T00:00:00Z", timesPlayed: 0 });
    expect(signals.get("b")).toMatchObject({ timesInSetlists: 1, lastInSetlistAt: "2026-02-01T00:00:00Z" });
  });

  it("counts completed shows only; the latest date wins", () => {
    const signals = computeSongSignals({
      songs,
      setlists: [setlist("s1", ["a", "b"]), setlist("s2", ["a"])],
      shows: [
        show("x", "s1", "2026-06-12"),
        show("y", "s2", "2026-03-01"),
        show("upcoming", "s1", "2026-12-01", { status: "upcoming" }),
        show("cancelled", "s1", "2026-07-01", { status: "cancelled" }),
        show("unlinked", null, "2026-08-01"),
        show("missing", "gone", "2026-08-01"),
      ],
    });
    expect(signals.get("a")).toMatchObject({
      timesPlayed: 2,
      lastPlayedAt: "2026-06-12",
      lastPlayedShow: { id: "x", name: "Show x", venue: "Venue x" },
    });
    expect(signals.get("b")).toMatchObject({ timesPlayed: 1, lastPlayedAt: "2026-06-12" });
    expect(signals.get("c")?.timesPlayed).toBe(0);
  });

  it("counts a completed show linked to a draft setlist as played, not as a setlist", () => {
    const signals = computeSongSignals({
      songs,
      setlists: [setlist("draft", ["a"], { is_draft: true })],
      shows: [show("x", "draft", "2026-05-01")],
    });
    expect(signals.get("a")).toMatchObject({ timesPlayed: 1, timesInSetlists: 0 });
  });

  it("omits a blank venue so the UI falls back to the show name", () => {
    const signals = computeSongSignals({
      songs,
      setlists: [setlist("s1", ["a"])],
      shows: [show("x", "s1", "2026-05-01", { venue: "  " })],
    });
    expect(signals.get("a")?.lastPlayedShow).toEqual({ id: "x", name: "Show x" });
  });

  it("ignores setlist songs that are not in the input songs", () => {
    const signals = computeSongSignals({ songs: [{ id: "a" }], setlists: [setlist("s1", ["a", "z"])], shows: [] });
    expect(signals.size).toBe(1);
  });
});

describe("playedStatus", () => {
  const played = (lastPlayedAt?: string, timesPlayed = 1): SongSignals => ({
    songId: "a",
    timesPlayed,
    timesInSetlists: 1,
    lastPlayedAt,
  });

  it("is never without a completed show", () => {
    expect(playedStatus(played(undefined, 0), "2026-09-27")).toBe("never");
  });

  it("is played on the 6-month boundary and stale one day before it", () => {
    expect(playedStatus(played("2026-03-27"), "2026-09-27")).toBe("played");
    expect(playedStatus(played("2026-03-26"), "2026-09-27")).toBe("stale");
  });

  it("clamps the boundary to the shorter month and crosses years", () => {
    // 31 Aug minus 6 months → 28 Feb (2026 is not a leap year).
    expect(playedStatus(played("2026-02-28"), "2026-08-31")).toBe("played");
    expect(playedStatus(played("2026-02-27"), "2026-08-31")).toBe("stale");
    expect(playedStatus(played("2025-08-15"), "2026-02-15")).toBe("played");
    expect(playedStatus(played("2025-08-14"), "2026-02-15")).toBe("stale");
  });

  it("takes a custom window", () => {
    expect(playedStatus(played("2026-08-01"), "2026-09-27", 1)).toBe("stale");
  });
});
