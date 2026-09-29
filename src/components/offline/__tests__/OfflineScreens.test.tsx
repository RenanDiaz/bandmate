// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { offlineKeys } from "../../../lib/offlineStore";
import type { OfflineSnapshot, OfflineSnapshotMeta } from "../../../services/offlineSetlistService";
import * as offline from "../../../services/offlineSetlistService";
import { items, performSnapshotRecords, serverRows, setlistRow } from "../../../test/performFixtures";
import { bandContext, renderApp, testBand } from "../../../test/renderApp";
import { AppMain } from "../../../AppMain";
import { OfflineLockedHome } from "../OfflineMessage";

// Service-module boundary: the offline screens only read through these.
vi.mock("../../../services/offlineSetlistService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services/offlineSetlistService")>();
  return {
    ...actual,
    listSnapshots: vi.fn(),
    getSnapshot: vi.fn(),
    getSnapshotMeta: vi.fn(),
    listInterruptedDownloads: vi.fn(),
    getSchemaWipeNotice: vi.fn(),
    dismissSchemaWipeNotice: vi.fn(),
    planDownload: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  };
});
// pdf.js needs browser APIs jsdom lacks; nothing here renders a PDF.
vi.mock("react-pdf", () => ({ Document: () => null, Page: () => null, pdfjs: { GlobalWorkerOptions: {} } }));
vi.mock("../../../lib/pdfWorker", () => ({}));
// The online views are never mounted offline; stubs make that visible.
vi.mock("../../Home", () => ({ default: () => <p>online dashboard</p> }));
vi.mock("../../SetlistsView", () => ({ default: () => <p>online setlists</p> }));
vi.mock("../../SetlistDetailView", () => ({ default: () => <p>online detail</p> }));
vi.mock("../../ShowsView", () => ({ default: () => <p>online shows</p> }));
vi.mock("../../SetlistPerformanceView", () => ({ default: () => <p>perform view</p> }));
vi.mock("../../BandSelector", () => ({ BandSelector: () => <p>band selector</p> }));

const BAND = testBand(7, "The Band");
const OTHER = testBand(8, "Other Band");

function fixture(extra: Parameters<typeof performSnapshotRecords>[1] = {}) {
  const records = performSnapshotRecords(serverRows(), extra);
  return {
    meta: records[offlineKeys.snapshotMeta("s1")] as OfflineSnapshotMeta,
    snapshot: records[offlineKeys.snapshot("s1")] as OfflineSnapshot,
  };
}

function metaOf(setlistId: string, setlistName: string, bandId: number): OfflineSnapshotMeta {
  return { ...fixture().meta, setlistId, setlistName, bandId };
}

const offlineCtx = (extra = {}) =>
  bandContext({ isOnline: false, selectedBand: BAND, bands: [BAND], ...extra });

beforeEach(() => {
  vi.mocked(offline.listSnapshots).mockResolvedValue([]);
  vi.mocked(offline.getSnapshot).mockResolvedValue(null);
  vi.mocked(offline.getSnapshotMeta).mockResolvedValue(null);
  vi.mocked(offline.listInterruptedDownloads).mockResolvedValue([]);
  vi.mocked(offline.getSchemaWipeNotice).mockResolvedValue(null);
  vi.mocked(offline.dismissSchemaWipeNotice).mockResolvedValue();
});

describe("OfflineHome (§7.3)", () => {
  it("lists the selected band's snapshots with saved state and Perform, and no dashboard", async () => {
    vi.mocked(offline.listSnapshots).mockResolvedValue([
      metaOf("s1", "Friday", BAND.id),
      metaOf("s2", "Saturday", BAND.id),
      metaOf("s9", "Not mine", OTHER.id),
    ]);
    renderApp(<AppMain />, { ctx: offlineCtx() });

    const list = await screen.findByTestId("offline-setlist-list");
    expect(within(list).getByText("Friday")).toBeTruthy();
    expect(within(list).getByText("Saturday")).toBeTruthy();
    expect(within(list).queryByText("Not mine")).toBeNull();
    expect(within(list).getAllByTestId("offline-badge")[0].textContent).toMatch(/Available offline/);
    expect(screen.queryByText("online dashboard")).toBeNull();
    expect(screen.getByText(/Other bands have setlists saved here/)).toBeTruthy();

    await userEvent.click(within(list).getAllByRole("button", { name: /Perform/ })[0]);
    expect(screen.getByTestId("location").textContent).toBe("/setlists/s1/perform");
  });

  it("shows interrupted downloads with the offline hint", async () => {
    vi.mocked(offline.listSnapshots).mockResolvedValue([metaOf("s1", "Friday", BAND.id)]);
    vi.mocked(offline.listInterruptedDownloads).mockResolvedValue([
      { setlistId: "s3", setlistName: "Sunday", startedAt: "2026-09-20T10:00:00.000Z" },
    ]);
    renderApp(<AppMain />, { ctx: offlineCtx() });
    const interrupted = await screen.findByTestId("offline-interrupted");
    expect(interrupted.textContent).toMatch(/Sunday/);
    expect(interrupted.textContent).toMatch(/Resumes when you're online/);
  });

  it("nothing saved → the empty state", async () => {
    renderApp(<AppMain />, { ctx: offlineCtx() });
    expect(await screen.findByText("You're offline and nothing is saved on this device")).toBeTruthy();
  });

  it("no local bands → the empty state, never the BandSelector", () => {
    renderApp(<AppMain />, { ctx: offlineCtx({ selectedBand: null, bands: [] }) });
    expect(screen.getByText("You're offline and nothing is saved on this device")).toBeTruthy();
    expect(screen.queryByText("band selector")).toBeNull();
  });

  it("several local bands and none selected → an offline band picker", async () => {
    const setSelectedBand = vi.fn();
    renderApp(<AppMain />, { ctx: offlineCtx({ selectedBand: null, bands: [BAND, OTHER], setSelectedBand }) });
    expect(screen.queryByText("band selector")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Other Band/ }));
    expect(setSelectedBand).toHaveBeenCalledWith(OTHER);
  });

  it("the band avatar falls back to the initial when the image fails", async () => {
    vi.mocked(offline.listSnapshots).mockResolvedValue([metaOf("s1", "Friday", BAND.id)]);
    const withAvatar = { ...BAND, avatar_url: "https://example.test/storage/v1/a.png" };
    const { container } = renderApp(<AppMain />, { ctx: offlineCtx({ selectedBand: withAvatar, bands: [withAvatar] }) });
    await screen.findByTestId("offline-setlist-list");
    const img = container.querySelector("img")!;
    img.dispatchEvent(new Event("error"));
    await waitFor(() => expect(screen.getByRole("img", { name: "The Band" }).textContent).toBe("T"));
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("session-lost (§7.1)", () => {
  it("locked home: a count, no setlist names, Sign in", () => {
    renderApp(<OfflineLockedHome count={2} />, { ctx: bandContext({ user: null, authMode: "session-lost" }) });
    expect(screen.getByText("Sign in again to use your offline setlists")).toBeTruthy();
    expect(screen.getByText(/2 setlists are saved on this device/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Sign in/ }).getAttribute("href")).toBe("/login");
    expect(offline.listSnapshots).not.toHaveBeenCalled();
  });
});

describe("schema-wipe notice (A4/A9)", () => {
  const entries = [
    { setlistId: "s1", setlistName: "Friday", bandId: BAND.id },
    { setlistId: "s2", setlistName: "Gala", bandId: OTHER.id },
  ];

  it("offline: names each setlist, labels other bands, 'Needs a connection', Dismiss clears it", async () => {
    vi.mocked(offline.getSchemaWipeNotice).mockResolvedValueOnce(entries).mockResolvedValue(null);
    renderApp(<AppMain />, { ctx: offlineCtx({ bands: [BAND, OTHER] }) });
    const notice = await screen.findByTestId("schema-wipe-notice");
    expect(notice.textContent).toMatch(/The app was updated/);
    expect(notice.textContent).toMatch(/Friday/);
    expect(notice.textContent).toMatch(/Gala · Other Band/);
    expect(within(notice).getAllByText("Needs a connection")).toHaveLength(2);
    expect(within(notice).queryByRole("button", { name: /Download/ })).toBeNull();

    await userEvent.click(within(notice).getByRole("button", { name: "Dismiss" }));
    expect(offline.dismissSchemaWipeNotice).toHaveBeenCalledWith(undefined);
    await waitFor(() => expect(screen.queryByTestId("schema-wipe-notice")).toBeNull());
  });

  it("online with a session: a Download button per setlist opens the plan flow", async () => {
    vi.mocked(offline.getSchemaWipeNotice).mockResolvedValue(entries);
    vi.mocked(offline.planDownload).mockReturnValue(new Promise(() => {}));
    const { SchemaWipeNotice } = await import("../SchemaWipeNotice");
    renderApp(<SchemaWipeNotice />, { ctx: bandContext({ selectedBand: BAND, bands: [BAND, OTHER] }) });
    const buttons = await screen.findAllByRole("button", { name: /Download/ });
    expect(buttons).toHaveLength(2);
    await userEvent.click(buttons[1]);
    expect(offline.planDownload).toHaveBeenCalledWith("s2");
  });

});

describe("OfflineSetlistDetail (§7.3)", () => {
  it("renders the snapshot: name, description, items in order, PDF counts, badge, Perform", async () => {
    const rows = serverRows();
    rows.setlist = setlistRow(
      [{ type: "section", id: "sec-1", label: "Set 1", position: 0 }, ...items().map((i) => ({ ...i, position: i.position + 1 }))],
      { description: "Main set" }
    );
    const records = performSnapshotRecords(rows, { stored: ["a1", "b1"] }); // a2 missing
    vi.mocked(offline.getSnapshot).mockResolvedValue(records[offlineKeys.snapshot("s1")] as OfflineSnapshot);
    vi.mocked(offline.getSnapshotMeta).mockResolvedValue(records[offlineKeys.snapshotMeta("s1")] as OfflineSnapshotMeta);

    renderApp(<AppMain />, { ctx: offlineCtx(), path: "/setlists/s1" });
    const detail = await screen.findByTestId("offline-setlist-detail");
    expect(screen.queryByText("online detail")).toBeNull();
    expect(within(detail).getByRole("heading", { name: "Friday" })).toBeTruthy();
    expect(detail.textContent).toMatch(/Main set/);

    const rowsInOrder = within(detail).getAllByRole("listitem").map((li) => li.getAttribute("data-testid"));
    expect(rowsInOrder).toEqual(["offline-item-section", "offline-item-song", "offline-item-break", "offline-item-song"]);
    const songs = within(detail).getAllByTestId("offline-item-song");
    expect(songs[0].textContent).toMatch(/Song a/);
    expect(songs[0].textContent).toMatch(/2 PDFs · 1 not downloaded/);
    expect(songs[1].textContent).toMatch(/1 PDF/);
    expect(songs[1].textContent).not.toMatch(/not downloaded/);
    expect(within(detail).getByTestId("offline-item-section").textContent).toMatch(/Section · Set 1/);
    expect(within(detail).getByTestId("offline-badge").textContent).toMatch(/Partial/);
    expect(within(detail).getByRole("link", { name: /Perform/ }).getAttribute("href")).toBe("/setlists/s1/perform");
  });

  it("no snapshot → 'Not available offline' with a link home, no online view", async () => {
    renderApp(<AppMain />, { ctx: offlineCtx(), path: "/setlists/s2" });
    expect(await screen.findByText("Not available offline")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Go to offline setlists/ }).getAttribute("href")).toBe("/");
    expect(screen.queryByText("online detail")).toBeNull();
  });
});

describe("routes without an offline screen", () => {
  it("render 'This page needs a connection' with a link home", () => {
    renderApp(<AppMain />, { ctx: offlineCtx(), path: "/shows" });
    expect(screen.getByText("This page needs a connection")).toBeTruthy();
    expect(screen.queryByText("online shows")).toBeNull();
    expect(screen.getByRole("link", { name: /Go to offline setlists/ }).getAttribute("href")).toBe("/");
  });

  it("performance mode still mounts offline (it reads the snapshot)", () => {
    renderApp(<AppMain />, { ctx: offlineCtx(), path: "/setlists/s1/perform" });
    expect(screen.getByText("perform view")).toBeTruthy();
  });

  it("static pages are not replaced", () => {
    renderApp(<AppMain />, { ctx: offlineCtx(), path: "/privacy" });
    expect(screen.queryByText("This page needs a connection")).toBeNull();
  });

  it("unknown paths still redirect home, which is the offline home", async () => {
    renderApp(
      <Routes>
        <Route path="*" element={<AppMain />} />
      </Routes>,
      { ctx: offlineCtx(), path: "/unknown" }
    );
    expect(screen.getByTestId("location").textContent).toBe("/");
    expect(await screen.findByText("You're offline and nothing is saved on this device")).toBeTruthy();
  });
});
