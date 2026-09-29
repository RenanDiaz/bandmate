// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { offlineKeys } from "../../../lib/offlineStore";
import type { OfflineSnapshotMeta } from "../../../services/offlineSetlistService";
import * as offline from "../../../services/offlineSetlistService";
import { performSnapshotRecords, serverRows } from "../../../test/performFixtures";
import { bandContext, renderApp } from "../../../test/renderApp";
import { OfflineDownloadAction, OfflineStatusRow } from "../OfflineDownloadAction";

// Service-module boundary: the row only reads through these.
vi.mock("../../../services/offlineSetlistService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services/offlineSetlistService")>();
  return {
    ...actual,
    getSnapshotMeta: vi.fn(),
    listInterruptedDownloads: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  };
});

const meta = (): OfflineSnapshotMeta =>
  performSnapshotRecords(serverRows())[offlineKeys.snapshotMeta("s1")] as OfflineSnapshotMeta;

const row = () => screen.getByTestId("offline-status-row");
const renderRow = (ctx = bandContext()) =>
  renderApp(<OfflineStatusRow setlistId="s1" setlistName="Friday" />, { ctx });

beforeEach(() => {
  vi.mocked(offline.getSnapshotMeta).mockResolvedValue(null);
  vi.mocked(offline.listInterruptedDownloads).mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
});

describe("OfflineStatusRow owns the setlist's offline state (spec §2.5)", () => {
  it("with no copy it offers Make available offline inside the row", async () => {
    renderRow();
    const button = await within(row()).findByRole("button", { name: "Make available offline" });
    expect(button).toHaveProperty("disabled", false);
    expect(within(row()).queryByTestId("offline-badge")).toBeNull();
  });

  it("without a connection the action is disabled with Needs a connection", async () => {
    renderRow(bandContext({ isOnline: false }));
    const button = await within(row()).findByRole("button", { name: "Needs a connection" });
    expect(button).toHaveProperty("disabled", true);
  });

  it("with a complete copy it shows the badge and Remove, and no download action", async () => {
    vi.mocked(offline.getSnapshotMeta).mockResolvedValue(meta());
    renderRow();
    await waitFor(() => expect(within(row()).getByTestId("offline-badge")).toBeTruthy());
    expect(within(row()).getByRole("button", { name: /Remove/ })).toBeTruthy();
    expect(within(row()).queryByRole("button", { name: "Make available offline" })).toBeNull();
  });

  it("with a partial copy it shows the badge, Retry and Remove", async () => {
    vi.mocked(offline.getSnapshotMeta).mockResolvedValue({ ...meta(), completeness: "partial" });
    renderRow();
    await waitFor(() => expect(within(row()).getByTestId("offline-badge")).toBeTruthy());
    expect(within(row()).getByRole("button", { name: /Retry/ })).toBeTruthy();
    expect(within(row()).getByRole("button", { name: /Remove/ })).toBeTruthy();
  });
});

describe("OfflineDownloadAction toolbar variant (performance mode)", () => {
  const renderToolbar = (showSavedBadge: boolean) =>
    renderApp(
      <div data-testid="toolbar">
        <OfflineDownloadAction setlistId="s1" setlistName="Friday" variant="toolbar" showSavedBadge={showSavedBadge} />
      </div>,
      { ctx: bandContext() }
    );

  it("on the snapshot it drops the saved badge: the source badge already says it", async () => {
    vi.mocked(offline.getSnapshotMeta).mockResolvedValue(meta());
    renderToolbar(false);
    await waitFor(() => expect(offline.getSnapshotMeta).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId("offline-badge")).toBeNull();
  });

  it("keeps the saved badge when asked, and the partial badge always", async () => {
    vi.mocked(offline.getSnapshotMeta).mockResolvedValue(meta());
    renderToolbar(true);
    await waitFor(() => expect(screen.getByTestId("offline-badge")).toBeTruthy());
    cleanup();
    vi.mocked(offline.getSnapshotMeta).mockResolvedValue({ ...meta(), completeness: "partial" });
    renderToolbar(false);
    await waitFor(() => expect(screen.getByTestId("offline-badge")).toBeTruthy());
    expect(screen.getByRole("button", { name: /Retry/ })).toBeTruthy();
  });
});
