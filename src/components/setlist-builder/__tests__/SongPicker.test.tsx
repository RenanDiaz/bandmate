// @vitest-environment jsdom
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import type { Song } from "../../../services/songsService";
import type { InputCapabilities } from "../../../hooks/useInputCapabilities";
import { PICKER_STATE_KEY } from "../../../hooks/usePickerState";
import type { SongSignals } from "../../../utils/songSignals";
import { bandContext, renderApp } from "../../../test/renderApp";
import { SongPicker, type SongPickerProps } from "../SongPicker";

const TODAY = "2026-09-27";
const POINTER: InputCapabilities = { hover: true, finePointer: true, wide: true };
const TOUCH: InputCapabilities = { hover: false, finePointer: false, wide: true };

function song(id: string, title: string, extra: Partial<Song> = {}): Song {
  return { id, band_id: 7, user_id: "u", title, artist: "Band", created_at: "2026-01-01T00:00:00Z", ...extra };
}

const SONGS = [
  song("a", "Alpha", { tags: ["rock"] }),
  song("b", "Bravo", { tags: ["ballad"] }),
  song("c", "Charlie"),
];

const SIGNALS = new Map<string, SongSignals>([
  [
    "a",
    {
      songId: "a",
      timesPlayed: 4,
      timesInSetlists: 5,
      lastPlayedAt: "2026-06-12",
      lastPlayedShow: { id: "sh", name: "Fiesta", venue: "Casa Bruja" },
    },
  ],
  ["b", { songId: "b", timesPlayed: 0, timesInSetlists: 3 }],
  ["c", { songId: "c", timesPlayed: 0, timesInSetlists: 0 }],
]);

function renderPicker(overrides: Partial<SongPickerProps> = {}) {
  const props: SongPickerProps = {
    songs: SONGS,
    totalSongs: SONGS.length,
    signals: SIGNALS,
    onAdd: vi.fn(),
    onAddSelected: vi.fn(),
    onEditSong: vi.fn(),
    layout: "panel",
    capabilities: POINTER,
    today: TODAY,
    ...overrides,
  };
  renderApp(<SongPicker {...props} />, { ctx: bandContext() });
  return props;
}

const rowOf = (title: string) => screen.getByText(title).closest("[data-picker-index]") as HTMLElement;
const visibleTitles = () =>
  [...document.querySelectorAll("[data-picker-index]")].map((row) => within(row as HTMLElement).getAllByText(/./)[0].textContent);

beforeEach(() => localStorage.clear());

describe("SongPicker signal line (AC1)", () => {
  it("shows played, in-setlists and never lines", () => {
    renderPicker();
    expect(within(rowOf("Alpha")).getByText("Played 4× · last: Casa Bruja, Jun 12")).toBeTruthy();
    expect(within(rowOf("Bravo")).getByText("In 3 setlists · never played")).toBeTruthy();
    expect(within(rowOf("Charlie")).getByText("Never in a setlist")).toBeTruthy();
  });

  it("falls back to the show name and adds the year for another year", () => {
    const signals = new Map(SIGNALS).set("a", {
      songId: "a",
      timesPlayed: 1,
      timesInSetlists: 1,
      lastPlayedAt: "2025-12-03",
      lastPlayedShow: { id: "sh", name: "Fiesta" },
    });
    renderPicker({ signals });
    expect(within(rowOf("Alpha")).getByText("Played 1× · last: Fiesta, Dec 3, 2025")).toBeTruthy();
  });

  it("renders without signal lines, Played chip or history sorts when signals are unavailable", () => {
    localStorage.setItem(PICKER_STATE_KEY, JSON.stringify({ filters: { played: ["never"] }, sort: "most_played" }));
    renderPicker({ signals: null });
    expect(screen.queryByText(/Never in a setlist|never played|Played/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Played/ })).toBeNull();
    // The stored Played filter is ignored, so nothing is hidden.
    expect(visibleTitles()).toEqual(["Alpha", "Bravo", "Charlie"]);
    const sort = screen.getByRole("combobox", { name: "Sort" }) as HTMLSelectElement;
    expect([...sort.options].map((o) => o.value)).not.toContain("most_played");
  });
});

describe("SongPicker selection", () => {
  it("touch: tapping rows selects them and Add N sends them in tap order (AC4)", () => {
    const props = renderPicker({ capabilities: TOUCH });
    fireEvent.click(screen.getByText("Charlie"));
    fireEvent.click(screen.getByText("Alpha"));
    fireEvent.click(screen.getByRole("button", { name: /Add 2 songs/ }));
    expect(props.onAddSelected).toHaveBeenCalledWith([SONGS[2], SONGS[0]], { asMedley: false });
    expect(screen.queryByRole("button", { name: /Add 2 songs/ })).toBeNull();
  });

  it("touch: a second tap deselects; Clear empties the selection", () => {
    renderPicker({ capabilities: TOUCH });
    fireEvent.click(screen.getByText("Alpha"));
    fireEvent.click(screen.getByText("Bravo"));
    fireEvent.click(screen.getByText("Alpha"));
    expect(screen.getByRole("button", { name: /Add 1 song$/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByRole("button", { name: /Add 1 song/ })).toBeNull();
  });

  it("touch: renders checkboxes and no hover-only controls", () => {
    renderPicker({ capabilities: TOUCH });
    expect(screen.getAllByRole("checkbox", { name: /Select / })).toHaveLength(3);
    expect(document.querySelector(".picker-reveal")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Edit song" })).toHaveLength(3);
  });

  it("pointer: a row click does not select; the checkbox does, Shift+click selects a range", () => {
    const props = renderPicker();
    fireEvent.click(screen.getByText("Alpha"));
    expect(screen.queryByRole("button", { name: /Add \d songs?/ })).toBeNull();

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Alpha" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Charlie" }), { shiftKey: true });
    fireEvent.click(screen.getByRole("button", { name: /Add 3 songs/ }));
    expect(props.onAddSelected).toHaveBeenCalledWith(SONGS, { asMedley: false });
    expect(document.querySelectorAll(".picker-reveal")).toHaveLength(3);
  });

  it("drops songs that left the list from the selection", () => {
    const onAddSelected = vi.fn();
    // The editor removes an added song from `songs`.
    function Harness() {
      const [songs, setSongs] = useState(SONGS);
      return (
        <SongPicker
          songs={songs}
          totalSongs={SONGS.length}
          signals={SIGNALS}
          onAdd={(added) => setSongs((list) => list.filter((s) => s.id !== added.id))}
          onAddSelected={onAddSelected}
          layout="panel"
          capabilities={TOUCH}
          today={TODAY}
        />
      );
    }
    renderApp(<Harness />, { ctx: bandContext() });
    fireEvent.click(screen.getByText("Alpha"));
    fireEvent.click(screen.getByText("Bravo"));
    fireEvent.click(within(rowOf("Alpha")).getByRole("button", { name: "Add to setlist" }));
    fireEvent.click(screen.getByRole("button", { name: /Add 1 song$/ }));
    expect(onAddSelected).toHaveBeenCalledWith([SONGS[1]], { asMedley: false });
  });
});

describe("SongPicker adding one song (AC6)", () => {
  it("\"+\" adds immediately and returns focus to the search", () => {
    const props = renderPicker();
    fireEvent.click(within(rowOf("Bravo")).getByRole("button", { name: "Add to setlist" }));
    expect(props.onAdd).toHaveBeenCalledWith(SONGS[1]);
    expect(document.activeElement).toBe(screen.getByRole("searchbox"));
  });

  it("Enter adds the highlighted result; arrows move the highlight", () => {
    const props = renderPicker();
    const search = screen.getByRole("searchbox");
    fireEvent.change(search, { target: { value: "a" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(props.onAdd).toHaveBeenLastCalledWith(SONGS[0]);
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(props.onAdd).toHaveBeenLastCalledWith(SONGS[1]);
  });

  it("/ focuses the search", () => {
    renderPicker();
    fireEvent.keyDown(document.body, { key: "/" });
    expect(document.activeElement).toBe(screen.getByRole("searchbox"));
  });
});

describe("SongPicker filters and sort", () => {
  it("filters change the rendered rows; Clear filters resets (AC2)", () => {
    renderPicker();
    fireEvent.click(screen.getByRole("button", { name: /Played/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Never played" }));
    expect(visibleTitles()).toEqual(["Bravo", "Charlie"]);

    fireEvent.click(screen.getByRole("button", { name: /Tags/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "rock" }));
    expect(visibleTitles()).toEqual([]);
    expect(screen.getByText("No songs match these filters")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "Clear filters" })[0]);
    expect(visibleTitles()).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("remembers filters and sort on the device (AC12)", () => {
    renderPicker();
    fireEvent.change(screen.getByRole("combobox", { name: "Sort" }), { target: { value: "longest_since_played" } });
    expect(visibleTitles()).toEqual(["Bravo", "Charlie", "Alpha"]);
    expect(JSON.parse(localStorage.getItem(PICKER_STATE_KEY)!)).toMatchObject({ sort: "longest_since_played" });
  });

  it("starts from the stored state and ignores a corrupt one", () => {
    localStorage.setItem(PICKER_STATE_KEY, JSON.stringify({ filters: { tags: ["ballad"] }, sort: "title_asc" }));
    renderPicker();
    expect(visibleTitles()).toEqual(["Bravo"]);
  });

  it("falls back to defaults on corrupt stored JSON", () => {
    localStorage.setItem(PICKER_STATE_KEY, "{not json");
    renderPicker();
    expect(visibleTitles()).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("hides chips with no values (no energy, one language)", () => {
    renderPicker();
    expect(screen.queryByRole("button", { name: /Energy/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Language/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Key/ })).toBeNull();
  });
});

describe("SongPicker empty states", () => {
  it("no songs in the library links to Songs", () => {
    renderPicker({ songs: [], totalSongs: 0 });
    expect(screen.getByText("No songs in library")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to Songs" }).getAttribute("href")).toBe("/songs");
  });

  it("all songs added", () => {
    renderPicker({ songs: [], totalSongs: 3 });
    expect(screen.getByText("All songs added to setlist")).toBeTruthy();
  });

  it("sheet: a close button and a footer that is always there", () => {
    const onClose = vi.fn();
    renderPicker({ layout: "sheet", capabilities: { ...TOUCH, wide: false }, onClose });
    expect((screen.getByRole("button", { name: /Add songs/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });
});
