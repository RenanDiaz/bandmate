import { describe, expect, it, vi } from "vitest";
import { PerformanceDataController, performanceCapabilities } from "../performanceDataController";
import { NoSnapshotError, PerformanceDataError } from "../performanceDataSource";
import type { PerformanceDataSource, PerformanceRows, PerformanceSession } from "../performanceDataSource";
import type { PerformanceTarget } from "../performanceTarget";
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

function fakeSource(kind: PerformanceDataSource["kind"], load: () => Promise<PerformanceRows>): FakeSource {
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
const songRows = rows("From song");
const SETLIST: PerformanceTarget = { kind: "setlist", setlistId: "s1" };
const SONG: PerformanceTarget = { kind: "song", songId: "x" };

function setup(opts: {
  hasSnapshot: boolean;
  online: boolean;
  target?: PerformanceTarget;
  songLoad?: () => Promise<PerformanceRows>;
}) {
  const snapshot = fakeSource("snapshot", async () => {
    if (!opts.hasSnapshot) throw new NoSnapshotError();
    return snapshotRows;
  });
  const network = fakeSource("network", async () => {
    if (!opts.online) throw new PerformanceDataError("network");
    return networkRows;
  });
  const song = fakeSource("song", opts.songLoad ?? (async () => songRows));
  const controller = new PerformanceDataController({
    target: opts.target ?? SETLIST,
    isOnline: () => opts.online,
    network,
    snapshot,
    song,
  });
  return { controller, snapshot, network, song };
}

describe("source selection (§8.2)", () => {
  it("snapshot + online → snapshot (no network load)", async () => {
    const { controller, network } = setup({ hasSnapshot: true, online: true });
    await flush();
    expect(controller.getState()).toMatchObject({ status: "ready", source: "snapshot", rows: snapshotRows });
    expect(network.opened).toBe(0);
  });

  it("snapshot + offline → snapshot", async () => {
    const { controller } = setup({ hasSnapshot: true, online: false });
    await flush();
    expect(controller.getState()).toMatchObject({ status: "ready", source: "snapshot" });
  });

  it("no snapshot + online → network", async () => {
    const { controller, snapshot } = setup({ hasSnapshot: false, online: true });
    await flush();
    expect(controller.getState()).toMatchObject({ status: "ready", source: "network", rows: networkRows });
    expect(snapshot.sessions[0].close).toHaveBeenCalled();
  });

  it("no snapshot + offline → 'Not available offline', no network attempt (B8)", async () => {
    const { controller, network } = setup({ hasSnapshot: false, online: false });
    await flush();
    expect(controller.getState()).toMatchObject({ status: "error", error: "network", unavailableOffline: true });
    expect(network.opened).toBe(0);
  });



  it("a setlist target never opens the song source", async () => {
    const { song } = setup({ hasSnapshot: false, online: true });
    await flush();
    expect(song.opened).toBe(0);
  });
});

describe("song target (song-performance §3.3)", () => {
  it.each([{ online: true }, { online: false }])("online=$online → the song source only", async ({ online }) => {
    const { controller, snapshot, network, song } = setup({ hasSnapshot: true, online, target: SONG });
    await flush();
    expect(controller.getState()).toMatchObject({ status: "ready", source: "song", rows: songRows, unavailableOffline: false });
    expect(song.opened).toBe(1);
    expect(snapshot.opened).toBe(0);
    expect(network.opened).toBe(0);
  });

  it("a load error maps to its code, never 'Not available offline'", async () => {
    const { controller, song } = setup({
      hasSnapshot: true,
      online: false,
      target: SONG,
      songLoad: async () => {
        throw new PerformanceDataError("network");
      },
    });
    await flush();
    expect(controller.getState()).toMatchObject({ status: "error", error: "network", source: "song", unavailableOffline: false });
    expect(song.sessions[0].close).toHaveBeenCalled();
  });

  it("not-found from the song source is kept", async () => {
    const { controller } = setup({
      hasSnapshot: false,
      online: true,
      target: SONG,
      songLoad: async () => {
        throw new PerformanceDataError("not-found");
      },
    });
    await flush();
    expect(controller.getState()).toMatchObject({ status: "error", error: "not-found" });
  });

  it("onOnline does not refresh a song session (only the snapshot source refreshes on reconnect)", async () => {
    const { controller, song } = setup({ hasSnapshot: false, online: true, target: SONG });
    await flush();
    controller.onOnline();
    expect(song.sessions[0].refresh).not.toHaveBeenCalled();
  });
});

describe("controller: emits and lifecycle", () => {
  it("emits after ready replace the rows", async () => {
    const { controller, snapshot } = setup({ hasSnapshot: true, online: true });
    await flush();
    const next = rows("Refreshed");
    snapshot.sessions[0].emit(next);
    expect(controller.getState().rows).toBe(next);
  });

  it("an emit that lands before load resolves is not lost", async () => {
    let resolve!: (r: PerformanceRows) => void;
    const snapshot = fakeSource("snapshot", () => new Promise((r) => (resolve = r)));
    const controller = new PerformanceDataController({
      target: SETLIST,
      isOnline: () => true,
      network: fakeSource("network", async () => networkRows),
      snapshot,
      song: fakeSource("song", async () => songRows),
    });
    const early = rows("Early refresh");
    snapshot.sessions[0].emit(early);
    resolve(snapshotRows);
    await flush();
    expect(controller.getState().rows).toBe(early);
  });

  it("onOnline refreshes the snapshot session; dispose closes it", async () => {
    const { controller, snapshot } = setup({ hasSnapshot: true, online: false });
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
    expect(performanceCapabilities({ role, isOnline, target: SETLIST })).toEqual({
      canReorder: edit,
      canUpload: edit,
      canEditNotes: edit,
      canSync: sync,
    });
  });

  it.each([
    { role: "owner", isOnline: true, upload: true },
    { role: "admin", isOnline: true, upload: true },
    { role: "member", isOnline: true, upload: true },
    { role: "member", isOnline: false, upload: false },
    { role: "guest", isOnline: true, upload: false },
    { role: "guest", isOnline: false, upload: false },
  ])("song target: $role, online=$isOnline → no reorder, sync or notes", ({ role, isOnline, upload }) => {
    expect(performanceCapabilities({ role, isOnline, target: SONG })).toEqual({
      canReorder: false,
      canUpload: upload,
      canEditNotes: false,
      canSync: false,
    });
  });
});
