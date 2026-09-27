// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Show } from "../../services/showsService";
import { getUpcomingShowsForBands } from "../../services/showsService";
import type { Rehearsal } from "../../services/rehearsalsService";
import { getUpcomingRehearsalsForBands } from "../../services/rehearsalsService";
import { bandContext, renderApp, testBand } from "../../test/renderApp";
import { MyUpcomingEvents, VISIBLE_EVENTS } from "../home/MyUpcomingEvents";

// Service-module boundary, like HomeOffline.test.tsx.
vi.mock("../../services/showsService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/showsService")>()),
  getUpcomingShowsForBands: vi.fn(),
}));
vi.mock("../../services/rehearsalsService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/rehearsalsService")>()),
  getUpcomingRehearsalsForBands: vi.fn(),
}));
// The band switch itself is covered by useOpenInBand.test.tsx (AC3); here we
// only assert what the section asks it to open.
const openInBand = vi.hoisted(() => vi.fn());
vi.mock("../../hooks/useOpenInBand", () => ({ useOpenInBand: () => openInBand }));

const A = testBand(1, "Los Rockers");
const B = testBand(2, "Jazz Trio");

function show(id: string, band_id: number, event_date: string, extra: Partial<Show> = {}): Show {
  return {
    id,
    band_id,
    user_id: "u",
    name: `Show ${id}`,
    event_date,
    status: "upcoming",
    created_at: "",
    updated_at: "",
    ...extra,
  };
}

function rehearsal(id: string, band_id: number, rehearsal_date: string): Rehearsal {
  return {
    id,
    band_id,
    user_id: "u",
    name: `Rehearsal ${id}`,
    rehearsal_date,
    status: "scheduled",
    created_at: "",
    updated_at: "",
  };
}

const section = () => screen.getByRole("region", { name: "My upcoming events" });
const rowOf = (name: string) => screen.getByText(name).closest<HTMLElement>("[data-testid=upcoming-event-row]")!;

beforeEach(() => {
  openInBand.mockReset();
  vi.mocked(getUpcomingShowsForBands).mockReset().mockResolvedValue([]);
  vi.mocked(getUpcomingRehearsalsForBands).mockReset().mockResolvedValue([]);
});

describe("MyUpcomingEvents (AC4)", () => {
  it("one band: renders nothing, not even the heading, and loads nothing", () => {
    const { container } = renderApp(<MyUpcomingEvents />, { ctx: bandContext({ bands: [A], selectedBand: A }) });
    expect(screen.queryByText("My upcoming events")).toBeNull();
    expect(container.querySelector("section")).toBeNull();
    expect(getUpcomingShowsForBands).not.toHaveBeenCalled();
    expect(getUpcomingRehearsalsForBands).not.toHaveBeenCalled();
  });

  it("two bands: one query each for both ids, rows carry the band names (the selected band's too)", async () => {
    vi.mocked(getUpcomingShowsForBands).mockResolvedValue([show("s1", 1, "2026-10-03")]);
    vi.mocked(getUpcomingRehearsalsForBands).mockResolvedValue([rehearsal("r1", 2, "2026-10-05")]);
    renderApp(<MyUpcomingEvents />, { ctx: bandContext({ bands: [B, A], selectedBand: A }) });

    expect(await screen.findByText("Show s1")).toBeTruthy();
    expect(getUpcomingShowsForBands).toHaveBeenCalledWith([1, 2]);
    expect(getUpcomingRehearsalsForBands).toHaveBeenCalledWith([1, 2]);
    expect(within(rowOf("Show s1")).getByText("Los Rockers")).toBeTruthy();
    expect(within(rowOf("Rehearsal r1")).getByText("Jazz Trio")).toBeTruthy();
  });

  it("empty: the empty line and no action button", async () => {
    renderApp(<MyUpcomingEvents />, { ctx: bandContext({ bands: [A, B], selectedBand: A }) });
    expect(await screen.findByText("No upcoming events in any of your bands")).toBeTruthy();
    expect(within(section()).queryByRole("button")).toBeNull();
  });

  it(`shows ${VISIBLE_EVENTS} rows; the 7th is hidden until "Show all", "Show fewer" collapses`, async () => {
    const shows = Array.from({ length: 7 }, (_, i) => show(`s${i + 1}`, 1 + (i % 2), `2026-10-0${i + 1}`));
    vi.mocked(getUpcomingShowsForBands).mockResolvedValue(shows);
    renderApp(<MyUpcomingEvents />, { ctx: bandContext({ bands: [A, B], selectedBand: A }) });

    expect(await screen.findByText("Show s6")).toBeTruthy();
    expect(screen.queryByText("Show s7")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Show all 7/ }));
    expect(screen.getByText("Show s7")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Show fewer/ }));
    expect(screen.queryByText("Show s7")).toBeNull();
  });

  it("a rejected read: the inline error line, no toast; Retry refetches", async () => {
    vi.mocked(getUpcomingShowsForBands).mockRejectedValueOnce(new Error("Failed to fetch"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reportNetworkFailure = vi.fn();
    renderApp(<MyUpcomingEvents />, {
      ctx: bandContext({ bands: [A, B], selectedBand: A, reportNetworkFailure }),
    });

    expect(await screen.findByText("Couldn't load your events")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Notifications" })).toBeNull();
    expect(reportNetworkFailure).not.toHaveBeenCalled();

    vi.mocked(getUpcomingShowsForBands).mockResolvedValue([show("s1", 1, "2026-10-03")]);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Show s1")).toBeTruthy();
    expect(getUpcomingShowsForBands).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Couldn't load your events")).toBeNull();
  });

  it("row tap opens the event in its band; the Setlist chip opens the setlist and not the row", async () => {
    vi.mocked(getUpcomingShowsForBands).mockResolvedValue([show("s1", 2, "2026-10-03", { setlist_id: "l1" })]);
    renderApp(<MyUpcomingEvents />, { ctx: bandContext({ bands: [A, B], selectedBand: A }) });

    await userEvent.click(await screen.findByText("Show s1"));
    expect(openInBand).toHaveBeenCalledWith(2, "/shows/s1");

    openInBand.mockReset();
    await userEvent.click(screen.getByRole("button", { name: "Setlist" }));
    expect(openInBand).toHaveBeenCalledTimes(1);
    expect(openInBand).toHaveBeenCalledWith(2, "/setlists/l1");
  });

  it("the chip is a real button: Enter and Space open the link only", async () => {
    vi.mocked(getUpcomingRehearsalsForBands).mockResolvedValue([
      { ...rehearsal("r1", 1, "2026-10-03"), show_id: "s9" },
    ]);
    renderApp(<MyUpcomingEvents />, { ctx: bandContext({ bands: [A, B], selectedBand: A }) });

    const chip = await screen.findByRole("button", { name: "Show" });
    chip.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(openInBand).toHaveBeenCalledTimes(2);
    expect(openInBand.mock.calls).toEqual([
      [1, "/shows/s9"],
      [1, "/shows/s9"],
    ]);
  });

  it("no Setlist chip without a setlist_id", async () => {
    vi.mocked(getUpcomingShowsForBands).mockResolvedValue([show("s1", 1, "2026-10-03")]);
    renderApp(<MyUpcomingEvents />, { ctx: bandContext({ bands: [A, B], selectedBand: A }) });
    await screen.findByText("Show s1");
    expect(screen.queryByRole("button", { name: "Setlist" })).toBeNull();
  });

  it("bands changed to the same ids (new objects, other order) doesn't refetch", async () => {
    const { setContext } = renderApp(<MyUpcomingEvents />, { ctx: bandContext({ bands: [A, B], selectedBand: A }) });
    await screen.findByText("No upcoming events in any of your bands");
    setContext(bandContext({ bands: [{ ...B }, { ...A }], selectedBand: A }));
    await screen.findByText("No upcoming events in any of your bands");
    expect(getUpcomingShowsForBands).toHaveBeenCalledTimes(1);
    expect(getUpcomingRehearsalsForBands).toHaveBeenCalledTimes(1);
  });

  it("a response for an old band set never overwrites the newer one", async () => {
    const C = testBand(3, "Folk Duo");
    let resolveOld: (shows: Show[]) => void = () => {};
    vi.mocked(getUpcomingShowsForBands)
      .mockImplementationOnce(() => new Promise((resolve) => (resolveOld = resolve)))
      .mockResolvedValueOnce([show("new", 3, "2026-10-04")]);

    const { setContext } = renderApp(<MyUpcomingEvents />, { ctx: bandContext({ bands: [A, B], selectedBand: A }) });
    setContext(bandContext({ bands: [A, B, C], selectedBand: A }));
    expect(await screen.findByText("Show new")).toBeTruthy();

    resolveOld([show("old", 1, "2026-10-02")]);
    await waitFor(() => expect(getUpcomingShowsForBands).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText("Show old")).toBeNull();
    expect(screen.getByText("Show new")).toBeTruthy();
  });
});
