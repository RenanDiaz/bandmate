// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import type { BandRole } from "../../services/bandMembersService";
import type { Song } from "../../services/songsService";
import type { Setlist } from "../../services/setlistsService";
import type { Show } from "../../services/showsService";
import type { Rehearsal } from "../../services/rehearsalsService";
import { bandContext, renderApp, testBand } from "../../test/renderApp";
import SongsView from "../SongsView";
import SetlistsView from "../SetlistsView";
import ShowsView from "../ShowsView";
import RehearsalsView from "../RehearsalsView";

// Service-module boundary: only the list reads are exercised; no write is ever called.
const FUTURE = "2099-06-01";
const song = { id: "s1", band_id: 7, user_id: "someone-else", title: "Song A", artist: "Artist", chords: "C G" } as Song;
const setlist = { id: "sl1", band_id: 7, user_id: "someone-else", name: "Set A", songs: [], is_draft: false } as unknown as Setlist;
const show = {
  id: "sh1", band_id: 7, user_id: "someone-else", name: "Show A", event_date: FUTURE, status: "scheduled",
  created_at: "", updated_at: "",
} as unknown as Show;
const rehearsal = {
  id: "r1", band_id: 7, user_id: "someone-else", name: "Rehearsal A", rehearsal_date: FUTURE, status: "scheduled",
  created_at: "", updated_at: "",
} as unknown as Rehearsal;

vi.mock("../../services/songsService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/songsService")>()),
  getBandSongs: vi.fn(async () => [song]),
}));
vi.mock("../../services/setlistsService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/setlistsService")>()),
  getBandSetlists: vi.fn(async () => [setlist]),
}));
vi.mock("../../services/showsService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/showsService")>()),
  getBandShows: vi.fn(async () => [show]),
}));
vi.mock("../../services/rehearsalsService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/rehearsalsService")>()),
  getUpcomingRehearsals: vi.fn(async () => [rehearsal]),
  getPastRehearsals: vi.fn(async () => []),
  getBandRehearsals: vi.fn(async () => [rehearsal]),
}));
// Creation forms make their own calls; a marker is enough to see whether they render.
vi.mock("../NewSongForm", () => ({ NewSongForm: () => <div data-testid="new-song-form" /> }));
vi.mock("../NewSetlistForm", () => ({ NewSetlistForm: () => <div data-testid="new-setlist-form" /> }));
vi.mock("../AISetlistGenerator", () => ({ AISetlistGenerator: () => <div data-testid="ai-generator" /> }));
vi.mock("../NewShowForm", () => ({ NewShowForm: () => <div data-testid="new-show-form" /> }));
vi.mock("../NewRehearsalForm", () => ({ NewRehearsalForm: () => <div data-testid="new-rehearsal-form" /> }));
vi.mock("../ImportSongsModal", () => ({ ImportSongsModal: () => null }));
vi.mock("react-pdf", () => ({ Document: () => null, Page: () => null, pdfjs: { GlobalWorkerOptions: {} } }));
vi.mock("../../lib/pdfWorker", () => ({}));
vi.mock("../ShowCalendar", () => ({ ShowCalendar: () => null }));

function renderView(View: typeof SongsView, role: BandRole | undefined) {
  const band = { ...testBand(7, "The Band"), user_role: role };
  const ctx = bandContext({ selectedBand: band, bands: [band] });
  return renderApp(<View user={ctx.user} selectedBand={band} />, { ctx });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe.each([
  { role: "member" as const, allowed: true },
  { role: "admin" as const, allowed: true },
  { role: "guest" as const, allowed: false },
  { role: undefined, allowed: false },
])("role $role", ({ role, allowed }) => {
  const expectPresence = (el: HTMLElement | null) => (allowed ? expect(el).not.toBeNull() : expect(el).toBeNull());

  it("SongsView: actions dropdown, new-song form and CSV import", async () => {
    const { container } = renderView(SongsView, role);
    await screen.findByText("Song A");
    expectPresence(container.querySelector(".actions-toggle"));
    expectPresence(screen.queryByTestId("new-song-form"));
    expectPresence(screen.queryByText("Import CSV"));
  });

  it("SongsView: Perform is shown to every role and opens the song's perform route", async () => {
    renderView(SongsView, role);
    await screen.findByText("Song A");
    fireEvent.click(screen.getByRole("button", { name: "Perform" }));
    expect(screen.getByTestId("location").textContent).toBe("/songs/s1/perform");
  });

  it("SetlistsView: edit/delete, new-setlist form and AI generator", async () => {
    renderView(SetlistsView, role);
    await screen.findAllByText("Set A");
    expectPresence(screen.queryByTitle("Delete setlist"));
    expectPresence(screen.queryByTestId("new-setlist-form"));
    expectPresence(screen.queryByTestId("ai-generator"));
  });

  it("ShowsView: edit/delete and new-show form", async () => {
    renderView(ShowsView, role);
    await screen.findAllByText("Show A");
    expectPresence(screen.queryAllByTitle("Delete show")[0] ?? null);
    expectPresence(screen.queryAllByTitle("Edit show")[0] ?? null);
    expectPresence(screen.queryByTestId("new-show-form"));
  });

  it("RehearsalsView: edit/delete/status and new-rehearsal form", async () => {
    renderView(RehearsalsView, role);
    await screen.findAllByText("Rehearsal A");
    expectPresence(screen.queryByTitle("Delete rehearsal"));
    expectPresence(screen.queryByTitle("Mark as completed"));
    expectPresence(screen.queryByTestId("new-rehearsal-form"));
  });
});
