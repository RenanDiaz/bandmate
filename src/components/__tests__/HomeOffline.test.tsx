// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { OFFLINE_FLAG_STORAGE_KEY } from "../../lib/featureFlags";
import { getBandSongs } from "../../services/songsService";
import { getBandSetlists } from "../../services/setlistsService";
import type { BandContextValue } from "../../test/renderApp";
import { bandContext, renderApp, testBand } from "../../test/renderApp";
import { AppMain } from "../../AppMain";

// Service-module boundary: Home's and SetlistsView's reads, and the offline reads.
vi.mock("../../services/songsService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/songsService")>()),
  getBandSongs: vi.fn(),
}));
vi.mock("../../services/setlistsService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/setlistsService")>()),
  getBandSetlists: vi.fn(),
}));
vi.mock("../../services/showsService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/showsService")>()),
  getUpcomingShows: vi.fn(async () => []),
}));
vi.mock("../../services/rehearsalsService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/rehearsalsService")>()),
  getUpcomingRehearsals: vi.fn(async () => []),
}));
vi.mock("../../services/bandMembersService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/bandMembersService")>()),
  getMyInvitations: vi.fn(async () => []),
}));
vi.mock("../../services/offlineSetlistService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/offlineSetlistService")>()),
  listSnapshots: vi.fn(async () => []),
  listInterruptedDownloads: vi.fn(async () => []),
  getSchemaWipeNotice: vi.fn(async () => null),
  subscribe: vi.fn(() => () => {}),
}));
vi.mock("react-pdf", () => ({ Document: () => null, Page: () => null, pdfjs: { GlobalWorkerOptions: {} } }));
vi.mock("../../lib/pdfWorker", () => ({}));
// SetlistsView's generator/form make their own calls; not under test here.
vi.mock("../AISetlistGenerator", () => ({ AISetlistGenerator: () => null }));
vi.mock("../NewSetlistForm", () => ({ NewSetlistForm: () => null }));

const BAND = testBand(7, "The Band");
// postgrest-js wraps a rejected fetch like this (src/lib/networkErrors.ts).
const networkError = { message: "TypeError: Failed to fetch", code: "", details: "", hint: "" };
const httpError = { message: "permission denied for table songs", code: "42501", details: "", hint: "" };

/** A context whose reportNetworkFailure() behaves like the real one: isOnline drops. */
function renderWithRealisticContext(path: string) {
  let setContext: (next: BandContextValue) => void = () => {};
  const reportNetworkFailure = vi.fn(() => setContext(bandContext({ ...base, isOnline: false, reportNetworkFailure })));
  const reportNetworkSuccess = vi.fn();
  const base = { selectedBand: BAND, bands: [BAND], reportNetworkSuccess };
  const result = renderApp(<AppMain />, { ctx: bandContext({ ...base, reportNetworkFailure }), path });
  setContext = result.setContext;
  return { reportNetworkFailure, reportNetworkSuccess };
}

beforeEach(() => {
  localStorage.setItem(OFFLINE_FLAG_STORAGE_KEY, "1");
  vi.mocked(getBandSongs).mockResolvedValue([]);
  vi.mocked(getBandSetlists).mockResolvedValue([]);
});

describe("weak signal on Home (§7.3)", () => {
  it("a successful load reports success (resets the backoff)", async () => {
    const { reportNetworkFailure, reportNetworkSuccess } = renderWithRealisticContext("/");
    await waitFor(() => expect(reportNetworkSuccess).toHaveBeenCalledTimes(1));
    expect(reportNetworkFailure).not.toHaveBeenCalled();
  });

  it("a network error reports the failure and renders the offline home, no error toast", async () => {
    vi.mocked(getBandSongs).mockRejectedValue(networkError);
    const { reportNetworkFailure } = renderWithRealisticContext("/");
    expect(await screen.findByText("You're offline and nothing is saved on this device")).toBeTruthy();
    expect(reportNetworkFailure).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Welcome back!")).toBeNull();
    expect(document.querySelector(".toast, [role=alert]")).toBeNull();
    expect(screen.getByTestId("location").textContent).toBe("/");
  });

  it("an HTTP error keeps today's dashboard: no offline home, no reportNetworkFailure", async () => {
    vi.mocked(getBandSongs).mockRejectedValue(httpError);
    const { reportNetworkFailure } = renderWithRealisticContext("/");
    await waitFor(() => expect(getBandSongs).toHaveBeenCalled());
    // Today's behaviour on a failed load: the dashboard with empty widgets.
    expect(await screen.findByText("Welcome back!")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(/Loading/i)).toBeNull());
    expect(reportNetworkFailure).not.toHaveBeenCalled();
    expect(screen.queryByTestId("offline-home")).toBeNull();
    expect(screen.queryByText("You're offline and nothing is saved on this device")).toBeNull();
  });
});

describe("weak signal on SetlistsView", () => {
  it("a network error renders the offline list", async () => {
    vi.mocked(getBandSetlists).mockRejectedValue(networkError);
    const { reportNetworkFailure } = renderWithRealisticContext("/setlists");
    expect(await screen.findByText("You're offline and nothing is saved on this device")).toBeTruthy();
    expect(reportNetworkFailure).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("location").textContent).toBe("/setlists");
  });

  it("a successful load reports success", async () => {
    const { reportNetworkSuccess } = renderWithRealisticContext("/setlists");
    await waitFor(() => expect(reportNetworkSuccess).toHaveBeenCalledTimes(1));
  });

  it("an HTTP error keeps the online list", async () => {
    vi.mocked(getBandSetlists).mockRejectedValue(httpError);
    const { reportNetworkFailure } = renderWithRealisticContext("/setlists");
    await waitFor(() => expect(getBandSetlists).toHaveBeenCalled());
    // Today's behaviour: the online list, empty.
    expect(await screen.findByText("No setlists yet")).toBeTruthy();
    expect(reportNetworkFailure).not.toHaveBeenCalled();
    expect(screen.queryByText("You're offline and nothing is saved on this device")).toBeNull();
  });
});

describe("session-lost on Home (§7.1, C5)", () => {
  it("hidden copies → the locked home with a count and no names, instead of the landing", () => {
    renderApp(<AppMain />, { ctx: bandContext({ user: null, authMode: "session-lost", hiddenOfflineCount: 2 }) });
    expect(screen.getByText("Sign in again to use your offline setlists")).toBeTruthy();
    expect(screen.getByText(/2 setlists are saved on this device/)).toBeTruthy();
  });

  it("nothing hidden → the landing as before", () => {
    renderApp(<AppMain />, { ctx: bandContext({ user: null, authMode: "session-lost", hiddenOfflineCount: 0 }) });
    expect(screen.queryByText("Sign in again to use your offline setlists")).toBeNull();
  });

  it("flag off → the landing as before", () => {
    localStorage.removeItem(OFFLINE_FLAG_STORAGE_KEY);
    renderApp(<AppMain />, { ctx: bandContext({ user: null, authMode: "session-lost", hiddenOfflineCount: 2 }) });
    expect(screen.queryByText("Sign in again to use your offline setlists")).toBeNull();
  });
});
