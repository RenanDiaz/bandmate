// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import type { Setlist } from "../../services/setlistsService";
import type { Song } from "../../services/songsService";
import type { Show } from "../../services/showsService";
import { bandContext, renderApp, testBand } from "../../test/renderApp";
import SetlistEditor from "../SetlistEditor";
import { getBandSetlists, getSetlist, updateSetlist } from "../../services/setlistsService";
import { getBandSongs } from "../../services/songsService";
import { getBandShows } from "../../services/showsService";
import { readCandidates, writeCandidates } from "../../lib/setlistCandidates";

// EditSongModal reaches react-pdf (sheet music); stub it like the other route tests.
vi.mock("react-pdf", () => ({ Document: () => null, Page: () => null, pdfjs: { GlobalWorkerOptions: {} } }));
vi.mock("../../lib/pdfWorker", () => ({}));
vi.mock("../../services/setlistsService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/setlistsService")>()),
  getSetlist: vi.fn(),
  getBandSetlists: vi.fn(),
  updateSetlist: vi.fn(),
}));
vi.mock("../../services/songsService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/songsService")>()),
  getBandSongs: vi.fn(),
}));
vi.mock("../../services/showsService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/showsService")>()),
  getBandShows: vi.fn(),
}));

const song = (id: string, title: string): Song => ({
  id,
  band_id: 7,
  user_id: "u",
  title,
  artist: "Band",
  duration: 180,
  created_at: "2026-01-01T00:00:00Z",
});

const SONGS = [song("a", "Alpha"), song("b", "Bravo"), song("c", "Charlie")];

const SETLIST: Setlist = {
  id: "sl1",
  band_id: 7,
  user_id: "u",
  name: "Friday",
  songs: [{ type: "song", song_id: "a", position: 0, notes: "" }],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const PAST: Setlist = {
  ...SETLIST,
  id: "old",
  songs: [{ type: "song", song_id: "b", position: 0 }],
};

const SHOW: Show = {
  id: "sh",
  band_id: 7,
  user_id: "u",
  setlist_id: "old",
  name: "Fiesta",
  venue: "Casa Bruja",
  event_date: "2026-06-12",
  status: "completed",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

/** A phone: narrow, touch (no hover, coarse pointer). */
function setPhone() {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

function renderEditor() {
  const ctx = bandContext({ selectedBand: { ...testBand(7), user_role: "member" } });
  renderApp(
    <Routes>
      <Route path="/setlists/:setlistId/edit" element={<SetlistEditor />} />
      <Route path="/setlists" element={<div>setlists page</div>} />
    </Routes>,
    { ctx, path: "/setlists/sl1/edit" }
  );
}

const setlistPanelTitles = () =>
  [...document.querySelectorAll("[aria-roledescription='sortable']")].map((el) => el.parentElement?.textContent ?? "");

beforeEach(() => {
  localStorage.clear();
  vi.mocked(getSetlist).mockResolvedValue(SETLIST);
  vi.mocked(getBandSongs).mockResolvedValue(SONGS);
  vi.mocked(getBandSetlists).mockResolvedValue([SETLIST, PAST]);
  vi.mocked(getBandShows).mockResolvedValue([SHOW]);
  vi.mocked(updateSetlist).mockResolvedValue(SETLIST);
});

afterEach(() => {
  // jsdom has no matchMedia: the hook falls back to wide + pointer.
  delete (window as { matchMedia?: unknown }).matchMedia;
  vi.clearAllMocks();
});

describe("SetlistEditor with the song picker", () => {
  it("wide: the picker lists songs not in the setlist with their signals; + appends", async () => {
    renderEditor();
    const bravo = await screen.findByText("Bravo");
    expect(screen.queryByRole("checkbox", { name: "Select Alpha" })).toBeNull();
    expect(getBandSetlists).toHaveBeenCalledWith(7, true);
    const row = bravo.closest("[data-picker-index]") as HTMLElement;
    expect(within(row).getByText(/Played 1× · last: Casa Bruja/)).toBeTruthy();

    fireEvent.click(within(row).getByRole("button", { name: "Add to setlist" }));
    expect(screen.queryByRole("checkbox", { name: "Select Bravo" })).toBeNull();
    expect(setlistPanelTitles().some((text) => text.includes("Bravo"))).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Save Setlist/ }));
    await waitFor(() => expect(updateSetlist).toHaveBeenCalled());
    expect(vi.mocked(updateSetlist).mock.calls[0][1].songs?.map((item) => item.type === "song" && item.song_id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("renders the picker without signals, and without a toast, when shows fail to load", async () => {
    vi.mocked(getBandShows).mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    renderEditor();
    await screen.findByText("Bravo");
    expect(screen.queryByText(/Played|never played|Never in a setlist/)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("setlists page")).toBeNull();
  });

  it("narrow: Add songs opens the full-screen picker; Add N appends and closes it (AC5)", async () => {
    setPhone();
    renderEditor();
    fireEvent.click(await screen.findByRole("button", { name: "Add songs" }));
    const sheet = screen.getByRole("dialog", { name: "Song Library" });

    fireEvent.click(within(sheet).getByText("Charlie"));
    fireEvent.click(within(sheet).getByText("Bravo"));
    fireEvent.click(within(sheet).getByRole("button", { name: "Add 2 songs" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    const panel = setlistPanelTitles();
    expect(panel.findIndex((text) => text.includes("Charlie"))).toBeLessThan(panel.findIndex((text) => text.includes("Bravo")));
    // Sticky footer: count, duration and Save; the header has no Save of its own.
    // Plan bar (setlist builder Phase 2) and sticky footer.
    expect(screen.getByTestId("plan-bar").textContent).toContain("9:00 of music");
    expect(screen.getAllByText(/3 songs · 9:00/)).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /Save Setlist/ })).toHaveLength(1);
  });

  it("narrow: Escape closes the picker without adding", async () => {
    setPhone();
    renderEditor();
    fireEvent.click(await screen.findByRole("button", { name: "Add songs" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(setlistPanelTitles()).toHaveLength(1);
  });
});

describe("SetlistEditor row menu and Delete (PR 1.2)", () => {
  const TWO: Setlist = {
    ...SETLIST,
    songs: [
      { type: "song", song_id: "a", position: 0, notes: "" },
      { type: "section", id: "sec", label: "Set 2", position: 1 },
      { type: "song", song_id: "b", position: 2, notes: "" },
    ],
  };

  async function save() {
    fireEvent.click(screen.getByRole("button", { name: /Save Setlist/ }));
    await waitFor(() => expect(updateSetlist).toHaveBeenCalled());
    return vi
      .mocked(updateSetlist)
      .mock.calls[0][1].songs?.map((item) => (item.type === "song" ? item.song_id : item.id));
  }

  it("moves a row to the top with the menu", async () => {
    vi.mocked(getSetlist).mockResolvedValue(TWO);
    renderEditor();
    fireEvent.click(await screen.findByRole("button", { name: "More actions for Bravo" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Move to top" }));
    expect(await save()).toEqual(["b", "a", "sec"]);
  });

  it("removes a row with the menu", async () => {
    vi.mocked(getSetlist).mockResolvedValue(TWO);
    renderEditor();
    fireEvent.click(await screen.findByRole("button", { name: "More actions for Set 2" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove" }));
    expect(await save()).toEqual(["a", "b"]);
  });

  it("Delete on a focused row removes it, but not while typing its notes", async () => {
    vi.mocked(getSetlist).mockResolvedValue(TWO);
    renderEditor();
    const notes = (await screen.findAllByPlaceholderText("Add notes for this song..."))[0];
    fireEvent.keyDown(notes, { key: "Delete" });
    const handle = document.querySelectorAll("[aria-roledescription='sortable']")[0];
    fireEvent.keyDown(handle, { key: "Delete" });
    expect(await save()).toEqual(["sec", "b"]);
  });
});

describe("SetlistEditor candidates (Phase 3, AC11)", () => {
  const EMPTY: Setlist = { ...SETLIST, songs: [] };

  it("stars survive a remount; saving with a candidate in the setlist drops it", async () => {
    renderEditor();
    fireEvent.click(await screen.findByRole("button", { name: "Mark Bravo as a candidate" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark Charlie as a candidate" }));
    expect(readCandidates("user-a", "sl1")).toEqual(["b", "c"]);

    // Adding it hides it (it leaves the picker); removing it again before saving brings the star back.
    const bravo = screen.getByText("Bravo").closest("[data-picker-index]") as HTMLElement;
    fireEvent.click(within(bravo).getByRole("button", { name: "Add to setlist" }));
    expect(screen.getByRole("button", { name: "Candidates (1)" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Save Setlist/ }));
    await waitFor(() => expect(updateSetlist).toHaveBeenCalled());
    await waitFor(() => expect(readCandidates("user-a", "sl1")).toEqual(["c"]));
  });

  it("loading a setlist that already has a candidate drops it", async () => {
    writeCandidates("user-a", "sl1", ["a", "c"]);
    renderEditor();
    await screen.findByText("Bravo");
    await waitFor(() => expect(readCandidates("user-a", "sl1")).toEqual(["c"]));
    expect(screen.getByRole("button", { name: "Remove Charlie from candidates" })).toBeTruthy();
  });

  it("empty setlist: says how many candidates wait and opens the Candidates tab", async () => {
    vi.mocked(getSetlist).mockResolvedValue(EMPTY);
    writeCandidates("user-a", "sl1", ["b", "c"]);
    renderEditor();
    expect(await screen.findByText("No songs yet — 2 candidates waiting")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show candidates" }));
    expect(screen.getByRole("button", { name: "Candidates (2)" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByText("Alpha")).toBeNull();
  });

  it("narrow: Show candidates opens the sheet on the Candidates tab", async () => {
    setPhone();
    vi.mocked(getSetlist).mockResolvedValue(EMPTY);
    writeCandidates("user-a", "sl1", ["c"]);
    renderEditor();
    fireEvent.click(await screen.findByRole("button", { name: "Show candidates" }));
    const sheet = screen.getByRole("dialog", { name: "Song Library" });
    expect(within(sheet).getByRole("button", { name: "Candidates (1)" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(sheet).queryByText("Bravo")).toBeNull();
    expect(within(sheet).getByText("Charlie")).toBeTruthy();
  });
});
