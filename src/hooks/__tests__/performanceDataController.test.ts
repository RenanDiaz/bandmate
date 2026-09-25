import { describe, expect, it, vi } from "vitest";
import { PerformanceDataController, performanceCapabilities } from "../performanceDataController";
import { NoSnapshotError, PerformanceDataError } from "../performanceDataSource";
import type { PerformanceDataSource, PerformanceRows, PerformanceSession } from "../performanceDataSource";
import { setlistRow } from "../../test/performFixtures";
import { flush } from "../../test/offlineFixtures";

function rows(name = "Friday"): PerformanceRows {
  return {
    setlist: setlistRow(undefined, { name }),
    songsById: {},
    sheetMusicBySongId: {},
    preferredSheetMusicIds: {},
    preferredInstrument: null,
  };
}

interface FakeSource extends PerformanceDataSource {
  opened: number;
  sessions: Array<PerformanceSession & { emit: (r: PerformanceRows) => void; refresh: ReturnType<typeof vi.fn> }>;
}

function fakeSource(kind: "network" | "snapshot", load: () => Promise<PerformanceRows>): FakeSource {
  const source: FakeSource = {
    kind,
    opened: 0,
    sessions: [],
    open() {
      source.opened++;
      const listeners = new Set<(r: PerformanceRows) => void>();
      const session = {
        load: vi.fn(load),
        subscribe: (l: (r: PerformanceRows) => void) => {
          listeners.add(l);
          return () => listeners.delete(l);
        },
        refresh: vi.fn(async () => undefined),
        isSheetMusicStale: () => false,
        resolvePdfUrl: vi.fn(),
        savePreference: vi.fn(),
        saveOrder: vi.fn(),
        close: vi.fn(),
        emit: (r: PerformanceRows) => listeners.forEach((l) => l(r)),
      };
      source.sessions.push(session as never);
      return session as never;
    },
  };
  return source;
}

const snapshotRows = rows("From snapshot");
const networkRows = rows("From network");

function setup(opts: { hasSnapshot: boolean; online: boolean; flag: boolean }) {
  const snapshot = fakeSource("snapshot", async () => {
    if (!opts.hasSnapshot) throw new NoSnapshotError();
    return snapshotRows;
  });
  const network = fakeSource("network", async () => {
    if (!opts.online) throw new PerformanceDataError("network");
    return networkRows;
  });
  const controller = new PerformanceDataController({
    setlistId: "s1",
    useSnapshots: opts.flag,
    isOnline: () => opts.online,
    network,
    snapshot,
  });
  return { controller, snapshot, network };
}

describe("source selection (§8.2)", () => {
  it("snapshot + online → snapshot (no network load)", async () => {
    const { controller, network } = setup({ hasSnapshot: true, online: true, flag: true });
    await flush();
    expect(controller.getState()).toMatchObject({ status: "ready", source: "snapshot", rows: snapshotRows });
    expect(network.opened).toBe(0);
  });

  it("snapshot + offline → snapshot", async () => {
    const { controller } = setup({ hasSnapshot: true, online: false, flag: true });
    await flush();
    expect(controller.getState()).toMatchObject({ status: "ready", source: "snapshot" });
  });

  it("no snapshot + online → network", async () => {
    const { controller, snapshot } = setup({ hasSnapshot: false, online: true, flag: true });
    await flush();
    expect(controller.getState()).toMatchObject({ status: "ready", source: "network", rows: networkRows });
    expect(snapshot.sessions[0].close).toHaveBeenCalled();
  });

  it("no snapshot + offline → 'Not available offline', no network attempt (B8)", async () => {
    const { controller, network } = setup({ hasSnapshot: false, online: false, flag: true });
    await flush();
    expect(controller.getState()).toMatchObject({ status: "error", error: "network", unavailableOffline: true });
    expect(network.opened).toBe(0);
  });

  it("flag off → network only, as before PR 2.4 (the snapshot is never opened)", async () => {
    const { controller, snapshot } = setup({ hasSnapshot: true, online: true, flag: false });
    await flush();
    expect(controller.getState()).toMatchObject({ status: "ready", source: "network" });
    expect(snapshot.opened).toBe(0);
  });

  it("flag off and offline → the network error, not 'Not available offline'", async () => {
    const { controller } = setup({ hasSnapshot: true, online: false, flag: false });
    await flush();
    expect(controller.getState()).toMatchObject({ status: "error", error: "network", unavailableOffline: false });
  });
});

describe("controller: emits and lifecycle", () => {
  it("emits after ready replace the rows", async () => {
    const { controller, snapshot } = setup({ hasSnapshot: true, online: true, flag: true });
    await flush();
    const next = rows("Refreshed");
    snapshot.sessions[0].emit(next);
    expect(controller.getState().rows).toBe(next);
  });

  it("an emit that lands before load resolves is not lost", async () => {
    let resolve!: (r: PerformanceRows) => void;
    const snapshot = fakeSource("snapshot", () => new Promise((r) => (resolve = r)));
    const controller = new PerformanceDataController({
      setlistId: "s1",
      useSnapshots: true,
      isOnline: () => true,
      network: fakeSource("network", async () => networkRows),
      snapshot,
    });
    const early = rows("Early refresh");
    snapshot.sessions[0].emit(early);
    resolve(snapshotRows);
    await flush();
    expect(controller.getState().rows).toBe(early);
  });

  it("onOnline refreshes the snapshot session; dispose closes it", async () => {
    const { controller, snapshot } = setup({ hasSnapshot: true, online: false, flag: true });
    await flush();
    controller.onOnline();
    expect(snapshot.sessions[0].refresh).toHaveBeenCalledTimes(1);
    controller.dispose();
    expect(snapshot.sessions[0].close).toHaveBeenCalled();
    expect(controller.getSession()).toBeNull();
  });
});

describe("performanceCapabilities (§8.3)", () => {
  it.each([
    { role: "member", isOnline: true, edit: true, sync: true },
    { role: "member", isOnline: false, edit: false, sync: false },
    { role: "guest", isOnline: true, edit: false, sync: true },
    { role: "guest", isOnline: false, edit: false, sync: false },
    { role: "owner", isOnline: true, edit: true, sync: true },
  ])("$role, online=$isOnline", ({ role, isOnline, edit, sync }) => {
    expect(performanceCapabilities({ role, isOnline })).toEqual({
      canReorder: edit,
      canUpload: edit,
      canEditNotes: edit,
      canSync: sync,
    });
  });
});
