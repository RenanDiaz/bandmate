// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import type { PerformanceData } from "../../hooks/useSetlistPerformanceData";
import type { Setlist } from "../../services/setlistsService";
import { setlistRow, song } from "../../test/performFixtures";
import { bandContext, renderApp, testBand } from "../../test/renderApp";
import { writePerformPosition } from "../../lib/performPosition";
import { PerformanceView } from "../SetlistPerformanceView";
import { useSetlistPerformanceData } from "../../hooks/useSetlistPerformanceData";

// The data layer has its own tests: here only the view's gating on the target.
vi.mock("../../hooks/useSetlistPerformanceData", () => ({ useSetlistPerformanceData: vi.fn() }));
vi.mock("../../hooks/usePerformanceSync", () => ({
  usePerformanceSync: () => ({ role: null, isConnected: false, isLoading: false, error: null, playbackTimeMs: 0, isAudioPlaying: false }),
}));
vi.mock("../SyncControls", () => ({ SyncControls: () => <div data-testid="sync-controls" /> }));
vi.mock("../offline/OfflineDownloadAction", () => ({ OfflineDownloadAction: () => <div data-testid="offline-toolbar" /> }));
vi.mock("react-pdf", () => ({ Document: () => null, Page: () => null, pdfjs: { GlobalWorkerOptions: {} } }));
vi.mock("../../lib/pdfWorker", () => ({}));

const x = { ...song("x", "Solo Song"), artist: "The Artist", chords: "C G" };
const a = { ...song("a", "Song a"), chords: "Am" };
const b = song("b", "Song b");

const songSetlist: Setlist = {
  ...setlistRow([{ type: "song", song_id: "x", position: 0, notes: "never shown" }]),
  id: "song:x",
  name: "Solo Song",
};

function data(overrides: Partial<PerformanceData>): PerformanceData {
  return {
    target: undefined,
    status: "ready",
    error: null,
    unavailableOffline: false,
    setlist: null,
    items: [],
    songsById: {},
    sheetMusicBySongId: {},
    preferredSheetMusicIds: {},
    preferredInstrument: null,
    resolvePdfUrl: vi.fn(),
    selectSheetMusic: vi.fn(),
    saveOrder: vi.fn(),
    onSheetMusicUploaded: vi.fn(),
    retryStaleSheetMusic: vi.fn(),
    source: "network",
    unavailableSheetMusicIds: new Set(),
    capabilities: { canReorder: true, canUpload: true, canSync: true, canEditNotes: true },
    ...overrides,
  };
}

const songData = () =>
  data({
    target: { kind: "song", songId: "x" },
    source: "song",
    setlist: songSetlist,
    items: songSetlist.songs,
    songsById: { x },
    capabilities: { canReorder: false, canUpload: true, canSync: false, canEditNotes: false },
  });

const BAND = { ...testBand(7), user_role: "member" as const };
const ctx = bandContext({ selectedBand: BAND, bands: [BAND] });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("PerformanceView, song target (song spec §2)", () => {
  it("hides the setlist chrome and shows the artist", () => {
    vi.mocked(useSetlistPerformanceData).mockReturnValue(songData());
    renderApp(<PerformanceView target={{ kind: "song", songId: "x" }} />, { ctx, path: "/songs/x/perform" });

    expect(screen.getAllByText("Solo Song").length).toBeGreaterThan(0);
    expect(screen.getAllByText("The Artist").length).toBeGreaterThan(0);
    expect(screen.queryByText("1 / 1")).toBeNull();
    expect(screen.queryByTestId("sync-controls")).toBeNull();
    expect(screen.queryByTestId("offline-toolbar")).toBeNull();
    expect(screen.queryByTitle("Song List (L)")).toBeNull();
    expect(screen.queryByText("Previous")).toBeNull();
    expect(screen.queryByText("Next")).toBeNull();
    expect(screen.queryByText("never shown")).toBeNull();
    expect(screen.queryByText(/Up next/i)).toBeNull();
  });

  it("l and r do nothing; Escape and X go back to /songs", () => {
    vi.mocked(useSetlistPerformanceData).mockReturnValue(songData());
    renderApp(<PerformanceView target={{ kind: "song", songId: "x" }} />, { ctx, path: "/songs/x/perform" });

    fireEvent.keyDown(window, { key: "l" });
    fireEvent.keyDown(window, { key: "r" });
    expect(screen.queryByText("Setlist")).toBeNull();
    expect(screen.getByTestId("location").textContent).toBe("/songs/x/perform");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByTestId("location").textContent).toBe("/songs");
  });

  it("X exits to /songs", () => {
    vi.mocked(useSetlistPerformanceData).mockReturnValue(songData());
    renderApp(<PerformanceView target={{ kind: "song", songId: "x" }} />, { ctx, path: "/songs/x/perform" });
    fireEvent.click(screen.getByTitle("Exit (ESC)"));
    expect(screen.getByTestId("location").textContent).toBe("/songs");
  });

  it("not found renders 'Song not found' + Back to songs, no bounce", () => {
    vi.mocked(useSetlistPerformanceData).mockReturnValue(
      data({ target: { kind: "song", songId: "gone" }, source: "song", status: "error", error: "not-found" })
    );
    renderApp(<PerformanceView target={{ kind: "song", songId: "gone" }} />, { ctx, path: "/songs/gone/perform" });

    expect(screen.getByText("Song not found")).toBeTruthy();
    expect(screen.getByTestId("location").textContent).toBe("/songs/gone/perform");
    fireEvent.click(screen.getByText("Back to songs"));
    expect(screen.getByTestId("location").textContent).toBe("/songs");
  });

  it("another load error toasts and bounces to /songs", async () => {
    vi.mocked(useSetlistPerformanceData).mockReturnValue(
      data({ target: { kind: "song", songId: "x" }, source: "song", status: "error", error: "network" })
    );
    // Under routes, as in the app: the bounce unmounts the view.
    renderApp(
      <Routes>
        <Route path="/songs/:songId/perform" element={<PerformanceView target={{ kind: "song", songId: "x" }} />} />
        <Route path="*" element={null} />
      </Routes>,
      { ctx, path: "/songs/x/perform" }
    );

    expect(await screen.findByText("Could not load the song")).toBeTruthy();
    expect(screen.getByTestId("location").textContent).toBe("/songs");
  });
});

describe("PerformanceView, setlist target", () => {
  it("keeps the counter, list, sync, offline toolbar and Prev/Next; opened directly, Escape goes to the detail", () => {
    const row = setlistRow();
    vi.mocked(useSetlistPerformanceData).mockReturnValue(
      data({ target: { kind: "setlist", setlistId: "s1" }, setlist: row, items: row.songs, songsById: { a, b } })
    );
    renderApp(<PerformanceView target={{ kind: "setlist", setlistId: "s1" }} />, { ctx, path: "/setlists/s1/perform" });

    expect(screen.getByText("1 / 3")).toBeTruthy();
    expect(screen.getByTestId("sync-controls")).toBeTruthy();
    expect(screen.getByTestId("offline-toolbar")).toBeTruthy();
    expect(screen.getByTitle("Song List (L)")).toBeTruthy();
    expect(screen.getByText("Previous")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByTestId("location").textContent).toBe("/setlists/s1");
  });

  it("opened from another page, X goes back to it", () => {
    const row = setlistRow();
    vi.mocked(useSetlistPerformanceData).mockReturnValue(
      data({ target: { kind: "setlist", setlistId: "s1" }, setlist: row, items: row.songs, songsById: { a, b } })
    );
    renderApp(<PerformanceView target={{ kind: "setlist", setlistId: "s1" }} />, {
      ctx,
      path: "/setlists/s1/perform",
      history: ["/shows/9"],
    });

    fireEvent.click(screen.getByTitle("Exit (ESC)"));
    expect(screen.getByTestId("location").textContent).toBe("/shows/9");
  });
});

describe("PerformanceView, ?song= start (Start performance here)", () => {
  const setlistData = () => {
    const row = setlistRow();
    return data({ target: { kind: "setlist", setlistId: "s1" }, setlist: row, items: row.songs, songsById: { a, b } });
  };

  it("opens on that song over the saved position and drops the param", () => {
    writePerformPosition("user-a", "s1", { currentIndex: 1, contentView: "lyrics", selectedSheetMusicId: null });
    vi.mocked(useSetlistPerformanceData).mockReturnValue(setlistData());
    renderApp(<PerformanceView target={{ kind: "setlist", setlistId: "s1" }} />, { ctx, path: "/setlists/s1/perform?song=b" });

    expect(screen.getByText("3 / 3")).toBeTruthy();
    const location = screen.getByTestId("location");
    expect(location.textContent).toBe("/setlists/s1/perform");
    expect(location.getAttribute("data-search")).toBe("");
  });

  it("from the detail, Escape after the start goes back to the detail, not out of the app", () => {
    vi.mocked(useSetlistPerformanceData).mockReturnValue(setlistData());
    renderApp(<PerformanceView target={{ kind: "setlist", setlistId: "s1" }} />, {
      ctx,
      path: "/setlists/s1/perform?song=b",
      history: ["/setlists", "/setlists/s1"],
    });

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByTestId("location").textContent).toBe("/setlists/s1");
  });

  it("a song not in the setlist falls back to the saved position", () => {
    writePerformPosition("user-a", "s1", { currentIndex: 1, contentView: "lyrics", selectedSheetMusicId: null });
    vi.mocked(useSetlistPerformanceData).mockReturnValue(setlistData());
    renderApp(<PerformanceView target={{ kind: "setlist", setlistId: "s1" }} />, { ctx, path: "/setlists/s1/perform?song=gone" });

    expect(screen.getByText("2 / 3")).toBeTruthy();
    expect(screen.getByTestId("location").getAttribute("data-search")).toBe("");
  });
});
