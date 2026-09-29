// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    planDownload: vi.fn(),
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

/** PR 3.2: outdated and deleted copies (spec §6.6, D2, D5). */
const outdated = (): OfflineSnapshotMeta => {
  const base = meta();
  const b2 = { storagePath: "7/b/b2.pdf", sheetMusicId: "b2", songId: "b", reason: "not-downloaded" as const, bytes: null };
  return { ...base, freshness: "outdated", missingFiles: [b2] };
};
const deleted = (): OfflineSnapshotMeta => ({ ...meta(), freshness: "deleted" });

describe("PR 3.2: outdated / deleted in the detail row", () => {
  it("outdated: badge Outdated and the update notice with its count", async () => {
    vi.mocked(offline.getSnapshotMeta).mockResolvedValue(outdated());
    renderRow();
    const notice = await within(row()).findByTestId("offline-update-notice");
    expect(notice.textContent).toContain("New sheet music is available for this setlist: 1 PDF to download.");
    expect(within(notice).getByRole("button", { name: "Update offline copy" })).toHaveProperty("disabled", false);
    expect(within(row()).getByTestId("offline-badge").getAttribute("data-state")).toBe("outdated");
    expect(within(row()).getByTestId("offline-badge").textContent).toContain("Outdated");
    expect(within(row()).getByRole("button", { name: /Remove/ })).toBeTruthy();
  });

  it("outdated without a connection: the update is disabled with Needs a connection", async () => {
    vi.mocked(offline.getSnapshotMeta).mockResolvedValue(outdated());
    renderRow(bandContext({ isOnline: false }));
    const notice = await within(row()).findByTestId("offline-update-notice");
    expect(within(notice).getByRole("button", { name: "Needs a connection" })).toHaveProperty("disabled", true);
  });

  it("Update offline copy plans and confirms with update wording (files only)", async () => {
    vi.mocked(offline.getSnapshotMeta).mockResolvedValue(outdated());
    vi.mocked(offline.planDownload).mockResolvedValue({
      setlistId: "s1",
      bandId: 7,
      songCount: 2,
      filesToDownload: [{ storagePath: "7/b/b2.pdf", sheetMusicId: "b2", songId: "b", rowUpdatedAt: "", bytes: 2_000_000 }],
      filesAlreadyPresent: [],
      filesToDelete: [],
      bytesToDownload: 2_000_000,
      filesWithUnknownSize: 0,
      bytesAlreadyPresent: 0,
      estimate: null,
    });
    renderRow();
    const notice = await within(row()).findByTestId("offline-update-notice");
    await userEvent.click(within(notice).getByRole("button", { name: "Update offline copy" }));
    expect(offline.planDownload).toHaveBeenCalledWith("s1");
    expect(await screen.findByText("Update offline copy?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Update" })).toBeTruthy();
    expect(document.body.textContent).toContain("2 MB");
  });

  it("deleted: badge Deleted on server, Remove, and no download action", async () => {
    vi.mocked(offline.getSnapshotMeta).mockResolvedValue({ ...deleted(), completeness: "partial" });
    renderRow();
    await waitFor(() => expect(within(row()).getByTestId("offline-badge").getAttribute("data-state")).toBe("deleted"));
    expect(within(row()).getByTestId("offline-badge").textContent).toContain("Deleted on server");
    expect(within(row()).getByRole("button", { name: /Remove/ })).toBeTruthy();
    expect(within(row()).queryByRole("button", { name: /Retry|Update|Make available/ })).toBeNull();
  });
});

describe("PR 3.2: toolbar (performance mode)", () => {
  const renderToolbar = () =>
    renderApp(
      <div data-testid="toolbar">
        <OfflineDownloadAction setlistId="s1" setlistName="Friday" variant="toolbar" showSavedBadge={false} />
      </div>,
      { ctx: bandContext() }
    );

  it("outdated: an Update offline copy button, no banner", async () => {
    vi.mocked(offline.getSnapshotMeta).mockResolvedValue(outdated());
    renderToolbar();
    expect(await screen.findByRole("button", { name: "Update offline copy" })).toBeTruthy();
    expect(screen.queryByTestId("offline-update-notice")).toBeNull();
  });

  it("deleted: the badge shows even on the snapshot, and no action", async () => {
    vi.mocked(offline.getSnapshotMeta).mockResolvedValue(deleted());
    renderToolbar();
    await waitFor(() => expect(screen.getByTestId("offline-badge").getAttribute("data-state")).toBe("deleted"));
    expect(within(screen.getByTestId("toolbar")).queryByRole("button")).toBeNull();
  });
});
