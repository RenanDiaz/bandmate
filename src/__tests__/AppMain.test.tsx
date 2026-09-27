// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { offlineKeys } from "../lib/offlineStore";
import { OFFLINE_FLAG_STORAGE_KEY } from "../lib/featureFlags";
import type { OfflineSnapshot, OfflineSnapshotMeta } from "../services/offlineSetlistService";
import * as offline from "../services/offlineSetlistService";
import { performSnapshotRecords } from "../test/performFixtures";
import { bandContext, renderApp, testBand } from "../test/renderApp";
import { AppMain } from "../AppMain";

vi.mock("../services/offlineSetlistService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/offlineSetlistService")>();
  return {
    ...actual,
    listSnapshots: vi.fn(),
    getSnapshot: vi.fn(),
    getSnapshotMeta: vi.fn(),
    listInterruptedDownloads: vi.fn(async () => []),
    getSchemaWipeNotice: vi.fn(async () => null),
    subscribe: vi.fn(() => () => {}),
  };
});
vi.mock("react-pdf", () => ({ Document: () => null, Page: () => null, pdfjs: { GlobalWorkerOptions: {} } }));
vi.mock("../lib/pdfWorker", () => ({}));
vi.mock("../components/Home", () => ({ default: () => <p>online dashboard</p> }));
vi.mock("../components/SetlistsView", () => ({ default: () => <p>online setlists</p> }));
vi.mock("../components/SetlistDetailView", () => ({ default: () => <p>online detail</p> }));
vi.mock("../components/ShowsView", () => ({ default: () => <p>online shows</p> }));
vi.mock("../components/SongPerformanceView", () => ({ default: () => <p>song perform view</p> }));
vi.mock("../components/BandSelector", () => ({ BandSelector: () => <p>band selector</p> }));

const BAND = testBand(7, "The Band");
const online = bandContext({ selectedBand: BAND, bands: [BAND] });
const offlineCtx = { ...online, isOnline: false };

beforeEach(() => {
  localStorage.setItem(OFFLINE_FLAG_STORAGE_KEY, "1");
  const records = performSnapshotRecords();
  vi.mocked(offline.listSnapshots).mockResolvedValue([records[offlineKeys.snapshotMeta("s1")] as OfflineSnapshotMeta]);
  vi.mocked(offline.getSnapshot).mockResolvedValue(records[offlineKeys.snapshot("s1")] as OfflineSnapshot);
  vi.mocked(offline.getSnapshotMeta).mockResolvedValue(records[offlineKeys.snapshotMeta("s1")] as OfflineSnapshotMeta);
});

describe("online ↔ offline keeps the route (§7.3)", () => {
  it.each([
    ["/", "online dashboard", "offline-home"],
    ["/setlists", "online setlists", "offline-setlists"],
    ["/setlists/s1", "online detail", "offline-setlist-detail"],
  ])("%s swaps views in place", async (path, onlineText, offlineTestId) => {
    const { setContext } = renderApp(<AppMain />, { ctx: online, path });
    expect(screen.getByText(onlineText)).toBeTruthy();

    setContext(offlineCtx);
    expect(await screen.findByTestId(offlineTestId)).toBeTruthy();
    expect(screen.queryByText(onlineText)).toBeNull();
    expect(screen.getByTestId("location").textContent).toBe(path);

    setContext(online);
    expect(screen.getByText(onlineText)).toBeTruthy();
    expect(screen.queryByTestId(offlineTestId)).toBeNull();
    expect(screen.getByTestId("location").textContent).toBe(path);
  });

  it("a route without an offline screen comes back to its online view", () => {
    const { setContext } = renderApp(<AppMain />, { ctx: offlineCtx, path: "/shows" });
    expect(screen.getByText("This page needs a connection")).toBeTruthy();
    setContext(online);
    expect(screen.getByText("online shows")).toBeTruthy();
    expect(screen.getByTestId("location").textContent).toBe("/shows");
  });

  it("/songs/:songId/perform is online only (song spec decision 3)", () => {
    const { setContext } = renderApp(<AppMain />, { ctx: offlineCtx, path: "/songs/s1/perform" });
    expect(screen.getByText("This page needs a connection")).toBeTruthy();
    expect(screen.queryByText("song perform view")).toBeNull();
    setContext(online);
    expect(screen.getByText("song perform view")).toBeTruthy();
    expect(screen.getByTestId("location").textContent).toBe("/songs/s1/perform");
  });

  it("offline-cached behaves as a normal offline session", async () => {
    renderApp(<AppMain />, {
      ctx: { ...offlineCtx, authMode: "offline-cached", user: { id: "user-a", offlineCached: true } },
    });
    expect(await screen.findByTestId("offline-home")).toBeTruthy();
  });

  it("with the flag off, offline changes nothing (today's views, BandSelector included)", () => {
    localStorage.removeItem(OFFLINE_FLAG_STORAGE_KEY);
    renderApp(<AppMain />, { ctx: offlineCtx, path: "/setlists/s1" });
    expect(screen.getByText("online detail")).toBeTruthy();

    renderApp(<AppMain />, { ctx: { ...offlineCtx, selectedBand: null, bands: [] } });
    expect(screen.getByText("band selector")).toBeTruthy();
  });

  it("no user (signed out / session-lost) keeps the online routes offline", () => {
    renderApp(<AppMain />, { ctx: { ...offlineCtx, user: null, authMode: "signed-out", selectedBand: null } });
    expect(screen.getByText("online dashboard")).toBeTruthy();
  });
});
