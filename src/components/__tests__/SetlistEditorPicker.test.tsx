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
    // Panel header and sticky footer.
    expect(screen.getAllByText(/3 songs · 9:00/)).toHaveLength(2);
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
