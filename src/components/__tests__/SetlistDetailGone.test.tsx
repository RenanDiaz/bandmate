// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { offlineKeys } from "../../lib/offlineStore";
import type { OfflineSnapshot, OfflineSnapshotMeta } from "../../services/offlineSetlistService";
import { performSnapshotRecords, serverRows } from "../../test/performFixtures";
import { bandContext, renderApp, testBand } from "../../test/renderApp";

vi.mock("../../services/setlistsService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/setlistsService")>()),
  getSetlist: vi.fn(),
}));
vi.mock("../../services/offlineSetlistService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/offlineSetlistService")>()),
  getSnapshot: vi.fn(),
  getSnapshotMeta: vi.fn(),
  listInterruptedDownloads: vi.fn(async () => []),
  checkForUpdates: vi.fn(async () => ({})),
  subscribe: vi.fn(() => () => {}),
}));
vi.mock("../../services/youtubeService", () => ({ youtubeService: { hasYouTubeAccess: vi.fn(async () => false) } }));
vi.mock("react-pdf", () => ({ Document: () => null, Page: () => null, pdfjs: { GlobalWorkerOptions: {} } }));
vi.mock("../../lib/pdfWorker", () => ({}));

import { getSetlist } from "../../services/setlistsService";
import * as offline from "../../services/offlineSetlistService";
import SetlistDetailView from "../SetlistDetailView";

/** D5 (PR 3.2): online, the server no longer returns the setlist but this device has a copy. */

const records = performSnapshotRecords(serverRows());
const meta = records[offlineKeys.snapshotMeta("s1")] as OfflineSnapshotMeta;
const snapshot = records[offlineKeys.snapshot("s1")] as OfflineSnapshot;
const gone = () => Object.assign(new Error("JSON object requested, multiple (or no) rows returned"), { code: "PGRST116" });

const renderDetail = () =>
  renderApp(
    <Routes>
      <Route path="/setlists/:setlistId" element={<SetlistDetailView />} />
      <Route path="/setlists" element={<p>setlists list</p>} />
    </Routes>,
    { ctx: bandContext({ selectedBand: testBand(7, "The Band") }), path: "/setlists/s1" }
  );

beforeEach(() => {
  vi.mocked(getSetlist).mockReset();
  vi.mocked(offline.getSnapshot).mockResolvedValue(snapshot);
  vi.mocked(offline.getSnapshotMeta).mockResolvedValue({ ...meta, freshness: "deleted" });
});

describe("SetlistDetailView when the setlist is gone on the server", () => {
  it("with a copy: renders the copy (no offline banner) with the deleted notice and Remove, no bounce", async () => {
    vi.mocked(getSetlist).mockRejectedValue(gone());
    renderDetail();
    const detail = await screen.findByTestId("offline-setlist-detail");
    expect(within(detail).getByTestId("offline-deleted-notice")).toBeTruthy();
    expect(within(detail).queryByText(/You're offline/)).toBeNull();
    expect(within(detail).getByRole("button", { name: /Remove offline copy/ })).toBeTruthy();
    expect(screen.getByTestId("location").textContent).toBe("/setlists/s1");
  });

  it("without a copy: the old behaviour (bounce to /setlists)", async () => {
    vi.mocked(getSetlist).mockRejectedValue(gone());
    vi.mocked(offline.getSnapshotMeta).mockResolvedValue(null);
    renderDetail();
    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/setlists"));
    expect(screen.queryByTestId("offline-setlist-detail")).toBeNull();
  });
});
