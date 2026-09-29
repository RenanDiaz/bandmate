// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { offlineKeys } from "../../../lib/offlineStore";
import type { OfflineSnapshotMeta } from "../../../services/offlineSetlistService";
import * as offline from "../../../services/offlineSetlistService";
import { performSnapshotRecords, serverRows } from "../../../test/performFixtures";
import { bandContext, renderApp, testBand } from "../../../test/renderApp";
import { AppMain } from "../../../AppMain";

// Service-module boundary: the page only reads and acts through these.
vi.mock("../../../services/offlineSetlistService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services/offlineSetlistService")>();
  return {
    ...actual,
    listSnapshots: vi.fn(),
    listOfflineBands: vi.fn(),
    getStorageUsage: vi.fn(),
    getSnapshotMeta: vi.fn(),
    listInterruptedDownloads: vi.fn(),
    getSchemaWipeNotice: vi.fn(),
    verifySnapshot: vi.fn(),
    checkForUpdates: vi.fn(),
    requestPersistence: vi.fn(),
    removeSnapshot: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  };
});
vi.mock("react-pdf", () => ({ Document: () => null, Page: () => null, pdfjs: { GlobalWorkerOptions: {} } }));
vi.mock("../../../lib/pdfWorker", () => ({}));
vi.mock("../../Home", () => ({ default: () => <p>online dashboard</p> }));
vi.mock("../../BandSelector", () => ({ BandSelector: () => <p>band selector</p> }));

/** PR 3.4, spec §6.6 (F1–F3): `/offline`, Offline setlists. */

const BAND = testBand(7, "The Band");
const OTHER = testBand(8, "Aardvarks");

function metaOf(setlistId: string, setlistName: string, bandId: number, extra: Partial<OfflineSnapshotMeta> = {}): OfflineSnapshotMeta {
  const base = performSnapshotRecords(serverRows())[offlineKeys.snapshotMeta("s1")] as OfflineSnapshotMeta;
  return { ...base, setlistId, setlistName, bandId, bytes: 2_500_000, ...extra };
}

const usage = (extra = {}) => ({
  usage: 30_000_000,
  quota: 1_000_000_000,
  persisted: true as boolean | null,
  bySetlist: [],
  distinctFileBytes: 4_000_000,
  ...extra,
});

const renderPage = (ctx = bandContext({ selectedBand: BAND, bands: [BAND] })) =>
  renderApp(<AppMain />, { ctx, path: "/offline" });

beforeEach(() => {
  vi.mocked(offline.listSnapshots).mockResolvedValue([
    metaOf("s1", "Friday", BAND.id, { freshness: "fresh", verifiedAt: "2026-09-25T10:00:00.000Z" }),
    metaOf("s2", "Wedding", OTHER.id, { freshness: "outdated", missingFiles: [{ storagePath: "8/x/y.pdf", sheetMusicId: "y", songId: "x", reason: "not-downloaded", bytes: null }] }),
  ]);
  vi.mocked(offline.listOfflineBands).mockResolvedValue([BAND, OTHER]);
  vi.mocked(offline.getStorageUsage).mockResolvedValue(usage());
  vi.mocked(offline.getSnapshotMeta).mockImplementation(async (id) => (await offline.listSnapshots()).find((m) => m.setlistId === id) ?? null);
  vi.mocked(offline.listInterruptedDownloads).mockResolvedValue([]);
  vi.mocked(offline.getSchemaWipeNotice).mockResolvedValue(null);
  vi.mocked(offline.verifySnapshot).mockResolvedValue({ ok: true, missing: [] });
  vi.mocked(offline.checkForUpdates).mockResolvedValue({});
  vi.mocked(offline.removeSnapshot).mockResolvedValue();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const rows = () => screen.getAllByTestId("offline-manager-row");

describe("Offline setlists (/offline)", () => {
  it("F1: every band's copies with band, saved date, size, freshness; usage and protection", async () => {
    renderPage();
    await waitFor(() => expect(rows()).toHaveLength(2));
    // Sorted by band name: Aardvarks before The Band.
    expect(rows()[0].textContent).toMatch(/Wedding/);
    expect(rows()[0].textContent).toMatch(/Aardvarks · Saved Sep 20, 2026 · 2.5 MB/);
    expect(within(rows()[0]).getByTestId("offline-badge").getAttribute("data-state")).toBe("outdated");
    expect(await within(rows()[0]).findByRole("button", { name: "Update offline copy" })).toBeTruthy();
    expect(within(rows()[1]).getByTestId("offline-badge").getAttribute("data-state")).toBe("available");
    expect(rows()[1].textContent).toMatch(/Verified Sep 25, 2026/);
    // One badge per row: the manage action never adds its own.
    expect(within(rows()[0]).getAllByTestId("offline-badge")).toHaveLength(1);
    expect(within(rows()[1]).queryByRole("button", { name: /Update|Retry/ })).toBeNull();

    const storage = screen.getByTestId("offline-storage");
    expect(storage.textContent).toMatch(/Offline copies use 4 MB/);
    expect(storage.textContent).toMatch(/30 MB of 1 GB/);
    expect(screen.getByTestId("offline-persisted").textContent).toMatch(/Protected/);
    expect(screen.getByRole("heading", { name: "2 setlists on this device" })).toBeTruthy();
  });

  it("F2: Verify reads the copy back and says so", async () => {
    renderPage();
    await waitFor(() => expect(rows()).toHaveLength(2));
    await userEvent.click(within(rows()[1]).getByRole("button", { name: /Verify/ }));
    expect(offline.verifySnapshot).toHaveBeenCalledWith("s1");
    expect(await screen.findByText("Every PDF of “Friday” reads back fine")).toBeTruthy();
  });

  it("F2: a failed verify names how many PDFs are missing", async () => {
    vi.mocked(offline.verifySnapshot).mockResolvedValue({
      ok: false,
      missing: [{ storagePath: "p", sheetMusicId: "a2", songId: "a", reason: "unknown", bytes: null }],
    });
    renderPage();
    await waitFor(() => expect(rows()).toHaveLength(2));
    await userEvent.click(within(rows()[1]).getByRole("button", { name: /Verify/ }));
    expect(await screen.findByText(/1 PDF of “Friday” is missing or damaged/)).toBeTruthy();
  });

  it("F3: Remove asks with a ConfirmModal, then removes", async () => {
    renderPage();
    await waitFor(() => expect(rows()).toHaveLength(2));
    await userEvent.click(within(rows()[1]).getByRole("button", { name: /Remove offline copy/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(offline.removeSnapshot).toHaveBeenCalledWith("s1"));
  });

  it("Check for updates runs the check online, and needs a connection offline", async () => {
    const { setContext } = renderPage();
    await waitFor(() => expect(rows()).toHaveLength(2));
    await userEvent.click(screen.getByTestId("offline-check-now"));
    expect(offline.checkForUpdates).toHaveBeenCalledWith();
    expect(await screen.findByText("Offline setlists checked")).toBeTruthy();

    setContext(bandContext({ selectedBand: BAND, bands: [BAND], isOnline: false }));
    await waitFor(() => expect(screen.getByTestId("offline-check-now").textContent).toMatch(/Needs a connection/));
    expect(screen.getByTestId("offline-check-now")).toHaveProperty("disabled", true);
  });

  it("not protected: explains and offers to ask when the browser supports it", async () => {
    vi.mocked(offline.getStorageUsage).mockResolvedValue(usage({ persisted: false }));
    vi.stubGlobal("navigator", { ...navigator, storage: { persist: vi.fn(), estimate: vi.fn() }, onLine: true });
    vi.mocked(offline.requestPersistence).mockResolvedValue(true);
    renderPage();
    const line = await screen.findByTestId("offline-persisted");
    expect(line.textContent).toMatch(/Not protected/);
    await userEvent.click(within(line).getByRole("button", { name: /Ask to protect them/ }));
    expect(offline.requestPersistence).toHaveBeenCalled();
    await waitFor(() => expect(vi.mocked(offline.getStorageUsage).mock.calls.length).toBeGreaterThan(1));
  });

  it("interrupted downloads are listed with Resume and Discard", async () => {
    vi.mocked(offline.listInterruptedDownloads).mockResolvedValue([
      { setlistId: "s9", setlistName: "Late show", startedAt: "2026-09-28T20:00:00.000Z" },
    ]);
    renderPage();
    const section = await screen.findByTestId("offline-manager-interrupted");
    expect(section.textContent).toMatch(/Late show/);
    expect(within(section).getByRole("button", { name: /Resume/ })).toBeTruthy();
    expect(within(section).getByRole("button", { name: /Discard/ })).toBeTruthy();
  });

  it("empty: says how to save one", async () => {
    vi.mocked(offline.listSnapshots).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(/Nothing is saved on this device yet/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Check for updates/ })).toBeNull();
  });
});

describe("/offline routing", () => {
  it("skips the band gate: reachable with no band selected", async () => {
    renderPage(bandContext({ selectedBand: null, bands: [BAND, OTHER] }));
    expect(await screen.findByTestId("offline-manager")).toBeTruthy();
    expect(screen.queryByText("band selector")).toBeNull();
  });

  it("works offline (the same page, not 'needs a connection')", async () => {
    renderPage(bandContext({ selectedBand: null, bands: [BAND], isOnline: false }));
    expect(await screen.findByTestId("offline-manager")).toBeTruthy();
    expect(screen.queryByText(/This page needs a connection/)).toBeNull();
  });

  it("in offline-cached too", async () => {
    renderPage(bandContext({ selectedBand: BAND, bands: [BAND], authMode: "offline-cached", isOnline: false }));
    expect(await screen.findByTestId("offline-manager")).toBeTruthy();
  });

  it("without a known user it goes home", async () => {
    renderPage(bandContext({ user: null, authMode: "session-lost" }));
    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/"));
  });
});
