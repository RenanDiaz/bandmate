import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  OFFLINE_SCHEMA_VERSION,
  OfflineError,
  confirmSignedInUser,
  countHiddenSnapshots,
  dismissSchemaWipeNotice,
  getFile,
  getLastUserId,
  getSchemaWipeNotice,
  getSnapshot,
  getSnapshotMeta,
  listOfflineBands,
  listSnapshots,
  openOfflineStore,
  setOfflineCurrentUser,
  subscribe,
  wipeAll,
} from "../offlineSetlistService";
import type { OfflineEvent } from "../offlineSetlistService";
import { offlineKeys } from "../../lib/offlineStore";
import { PERFORM_POSITION_KEY_PREFIX, performPositionKey } from "../../lib/performPosition";
import { band, rawEntries, rawKeys, resetOfflineTestEnv, seedRaw, snapshotRecords, storeMeta } from "../../test/offlineFixtures";

const USER_A = "user-a";
const USER_B = "user-b";

beforeEach(() => {
  resetOfflineTestEnv();
});

describe("empty store", () => {
  it("initializes meta on first open and every read is empty/null", async () => {
    const meta = await openOfflineStore();
    expect(meta).toEqual({ schemaVersion: OFFLINE_SCHEMA_VERSION, persisted: null, lastGcAt: null });

    setOfflineCurrentUser(USER_A);
    expect(await listSnapshots()).toEqual([]);
    expect(await getSnapshotMeta("s1")).toBeNull();
    expect(await getSnapshot("s1")).toBeNull();
    expect(await getFile("1/x/y.pdf")).toBeNull();
    expect(await listOfflineBands()).toEqual([]);
    expect(await getLastUserId()).toBeNull();
    expect(await getSchemaWipeNotice()).toBeNull();
    expect(await rawKeys()).toEqual([offlineKeys.meta]);
  });
});

describe("schema guard (§3.5 #2, A4)", () => {
  it("wipes a store of another schema version and records what was lost", async () => {
    await seedRaw({
      ...storeMeta(OFFLINE_SCHEMA_VERSION + 1),
      ...snapshotRecords({ userId: USER_A, setlistId: "s1", setlistName: "Friday", bandId: 7 }),
      ...snapshotRecords({ userId: USER_B, setlistId: "s2", setlistName: "Saturday", bandId: 8 }),
      [offlineKeys.lastUser]: USER_A,
    });
    const events: OfflineEvent[] = [];
    subscribe((e) => events.push(e));

    await openOfflineStore();

    const stored = await rawEntries();
    expect(Object.keys(stored).sort()).toEqual(
      [offlineKeys.lastUser, offlineKeys.meta, offlineKeys.schemaWipeNotice].sort()
    );
    // A schema wipe is not an auth event: last-user survives it.
    expect(stored[offlineKeys.lastUser]).toBe(USER_A);
    expect(stored[offlineKeys.meta]).toMatchObject({ schemaVersion: OFFLINE_SCHEMA_VERSION });
    expect(stored[offlineKeys.schemaWipeNotice]).toMatchObject({
      fromVersion: OFFLINE_SCHEMA_VERSION + 1,
      toVersion: OFFLINE_SCHEMA_VERSION,
    });
    expect(stored[offlineKeys.schemaWipeNotice]).not.toHaveProperty("dismissedBy");
    expect(events).toContainEqual({ type: "store-wiped", reason: "schema" });

    // Each user sees only their own entries.
    setOfflineCurrentUser(USER_A);
    expect(await getSchemaWipeNotice()).toEqual([{ setlistId: "s1", setlistName: "Friday", bandId: 7 }]);
    setOfflineCurrentUser(USER_B);
    expect(await getSchemaWipeNotice()).toEqual([{ setlistId: "s2", setlistName: "Saturday", bandId: 8 }]);
  });

  it("treats a missing meta on a non-empty store as a mismatch", async () => {
    await seedRaw(snapshotRecords({ userId: USER_A, setlistId: "s1" }));
    await openOfflineStore();
    const stored = await rawEntries();
    expect(stored[offlineKeys.schemaWipeNotice]).toMatchObject({ fromVersion: null });
    expect(Object.keys(stored).some((k) => k.startsWith("file:"))).toBe(false);
  });

  it("does not write a notice when nothing was lost", async () => {
    await seedRaw({ ...storeMeta(0), [offlineKeys.band(1)]: band(1) });
    await openOfflineStore();
    expect(await rawKeys()).toEqual([offlineKeys.meta]);
  });

  it("wipes when a record carries another schema version", async () => {
    await seedRaw({ ...storeMeta(), ...snapshotRecords({ userId: USER_A, setlistId: "s1", schemaVersion: 99 }) });
    setOfflineCurrentUser(USER_A);
    expect(await listSnapshots()).toEqual([]);
    expect(await rawKeys()).toEqual([offlineKeys.meta, offlineKeys.schemaWipeNotice]);
  });

  it("dismissing all of the current user's entries deletes the notice", async () => {
    await seedRaw({
      ...storeMeta(0),
      ...snapshotRecords({ userId: USER_A, setlistId: "s1" }),
      ...snapshotRecords({ userId: USER_A, setlistId: "s3" }),
    });
    setOfflineCurrentUser(USER_A);
    expect((await getSchemaWipeNotice())?.map((e) => e.setlistId).sort()).toEqual(["s1", "s3"]);
    await dismissSchemaWipeNotice();
    expect(await getSchemaWipeNotice()).toBeNull();
    expect(await rawKeys()).not.toContain(offlineKeys.schemaWipeNotice);
  });

  it("dropping the last entry by id deletes the notice", async () => {
    await seedRaw({ ...storeMeta(0), ...snapshotRecords({ userId: USER_A, setlistId: "s1" }) });
    setOfflineCurrentUser(USER_A);
    await dismissSchemaWipeNotice("s1");
    expect(await rawKeys()).not.toContain(offlineKeys.schemaWipeNotice);
  });

  it("another user's entries (failed-wipe leftovers) are never returned or dismissed", async () => {
    await seedRaw({
      ...storeMeta(0),
      ...snapshotRecords({ userId: USER_A, setlistId: "s1" }),
      ...snapshotRecords({ userId: USER_A, setlistId: "s3" }),
      ...snapshotRecords({ userId: USER_B, setlistId: "s2" }),
    });
    setOfflineCurrentUser(USER_A);
    await dismissSchemaWipeNotice("s1");
    expect((await getSchemaWipeNotice())?.map((e) => e.setlistId)).toEqual(["s3"]);
    await dismissSchemaWipeNotice();
    expect(await getSchemaWipeNotice()).toBeNull();
    expect(await rawKeys()).toContain(offlineKeys.schemaWipeNotice);

    setOfflineCurrentUser(USER_B);
    expect((await getSchemaWipeNotice())?.map((e) => e.setlistId)).toEqual(["s2"]);
    await dismissSchemaWipeNotice();
    expect(await rawKeys()).not.toContain(offlineKeys.schemaWipeNotice);
  });
});

describe("owner filter (§3.5 #1)", () => {
  beforeEach(async () => {
    await seedRaw({
      ...storeMeta(),
      ...snapshotRecords({ userId: USER_A, setlistId: "a1", bandId: 1, savedAt: "2026-09-20T10:00:00.000Z" }),
      ...snapshotRecords({ userId: USER_A, setlistId: "a2", bandId: 2, savedAt: "2026-09-21T10:00:00.000Z" }),
      ...snapshotRecords({ userId: USER_B, setlistId: "b1", bandId: 3 }),
    });
  });

  it("returns only the current user's records", async () => {
    setOfflineCurrentUser(USER_A);
    expect((await listSnapshots()).map((m) => m.setlistId)).toEqual(["a2", "a1"]); // newest first
    expect(await getSnapshotMeta("b1")).toBeNull();
    expect(await getSnapshot("b1")).toBeNull();
    expect((await getSnapshot("a1"))?.setlistId).toBe("a1");
    expect((await listOfflineBands()).map((b) => b.id)).toEqual([1, 2]);

    setOfflineCurrentUser(USER_B);
    expect((await listSnapshots()).map((m) => m.setlistId)).toEqual(["b1"]);
    expect(await getSnapshot("a1")).toBeNull();
    expect((await listOfflineBands()).map((b) => b.id)).toEqual([3]);
  });

  it("returns nothing with no current user, without deleting anything", async () => {
    const before = await rawKeys();
    setOfflineCurrentUser(null);
    expect(await listSnapshots()).toEqual([]);
    expect(await getSnapshot("a1")).toBeNull();
    expect(await getFile("1/song-a1/sm-a1.pdf")).toBeNull();
    expect(await listOfflineBands()).toEqual([]);
    expect(await rawKeys()).toEqual(before);
    expect(await countHiddenSnapshots(USER_A)).toBe(2);
  });

  it("treats a meta without its snapshot as absent (§3.5 #4)", async () => {
    await seedRaw(snapshotRecords({ userId: USER_A, setlistId: "a3" }));
    const { del, createStore } = await import("idb-keyval");
    await del(offlineKeys.snapshot("a3"), createStore("bandmate-offline", "kv"));
    setOfflineCurrentUser(USER_A);
    expect((await listSnapshots()).map((m) => m.setlistId)).not.toContain("a3");
    expect(await getSnapshotMeta("a3")).toBeNull();
  });

  it("returns stored files to a current user", async () => {
    setOfflineCurrentUser(USER_A);
    const blob = await getFile("1/song-a1/sm-a1.pdf");
    expect(blob).not.toBeNull();
    expect(await blob!.text()).toBe("%PDF");
  });

  it("emits visibility-changed when the current user changes", async () => {
    const events: OfflineEvent[] = [];
    subscribe((e) => events.push(e));
    setOfflineCurrentUser(USER_A);
    setOfflineCurrentUser(USER_A);
    setOfflineCurrentUser(null);
    expect(events).toEqual([{ type: "visibility-changed" }, { type: "visibility-changed" }]);
  });
});

describe("confirmSignedInUser and wipeAll (§3.5 #6)", () => {
  beforeEach(async () => {
    await seedRaw({ ...storeMeta(), ...snapshotRecords({ userId: USER_A, setlistId: "a1" }) });
    localStorage.setItem(performPositionKey(USER_A, "a1"), "{}");
    localStorage.setItem("bandmate_preferred_instrument_x", "guitar");
  });

  it("writes last-user on first confirmation, keeps data for the same uid", async () => {
    expect(await confirmSignedInUser(USER_A)).toEqual({ wiped: false });
    expect(await getLastUserId()).toBe(USER_A);
    expect(await confirmSignedInUser(USER_A)).toEqual({ wiped: false });
    expect((await rawKeys()).filter((k) => k.startsWith("file:"))).toHaveLength(1);
  });

  it("wipes first when a different uid is confirmed", async () => {
    await confirmSignedInUser(USER_A);
    const events: OfflineEvent[] = [];
    subscribe((e) => events.push(e));
    expect(await confirmSignedInUser(USER_B)).toEqual({ wiped: true });
    expect(await rawKeys()).toEqual([offlineKeys.lastUser, offlineKeys.meta]);
    expect(await getLastUserId()).toBe(USER_B);
    expect(localStorage.getItem(performPositionKey(USER_A, "a1"))).toBeNull();
    expect(events).toContainEqual({ type: "store-wiped", reason: "user-changed" });
  });

  it("wipeAll empties the store, last-user included, and removes position keys only", async () => {
    await confirmSignedInUser(USER_A);
    await wipeAll();
    setOfflineCurrentUser(USER_A);
    expect(await listSnapshots()).toEqual([]);
    expect(await rawKeys()).toEqual([offlineKeys.meta]);
    expect(await getLastUserId()).toBeNull();
    const remaining = Object.keys(Object.fromEntries(Array.from({ length: localStorage.length }, (_, i) => [localStorage.key(i), 1])));
    expect(remaining.some((k) => k.startsWith(PERFORM_POSITION_KEY_PREFIX))).toBe(false);
    expect(localStorage.getItem("bandmate_preferred_instrument_x")).toBe("guitar");
  });
});

describe("storage unavailable (§5.4)", () => {
  function breakIndexedDb(mode: "missing" | "open-fails") {
    if (mode === "missing") {
      Object.defineProperty(globalThis, "indexedDB", { value: undefined, configurable: true, writable: true });
      return;
    }
    const failing = {
      open: () => {
        const request = {
          error: new DOMException("private mode", "InvalidStateError"),
          onsuccess: null as null | (() => void),
          onerror: null as null | (() => void),
          addEventListener() {},
        };
        setTimeout(() => request.onerror?.(), 0);
        return request;
      },
    };
    Object.defineProperty(globalThis, "indexedDB", { value: failing, configurable: true, writable: true });
  }

  for (const mode of ["missing", "open-fails"] as const) {
    it(`reads return empty/null and never throw (${mode})`, async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      breakIndexedDb(mode);
      setOfflineCurrentUser(USER_A);

      await expect(openOfflineStore()).rejects.toMatchObject({ code: "storage-unavailable" });
      await expect(openOfflineStore()).rejects.toBeInstanceOf(OfflineError);
      expect(await listSnapshots()).toEqual([]);
      expect(await getSnapshotMeta("s1")).toBeNull();
      expect(await getSnapshot("s1")).toBeNull();
      expect(await getFile("a/b.pdf")).toBeNull();
      expect(await listOfflineBands()).toEqual([]);
      expect(await getLastUserId()).toBeNull();
      expect(await countHiddenSnapshots(USER_A)).toBe(0);
      expect(await getSchemaWipeNotice()).toBeNull();
      expect(await confirmSignedInUser(USER_A)).toEqual({ wiped: false });
      await expect(wipeAll()).resolves.toBeUndefined();
    });
  }

  it("wipeAll still removes position keys when IndexedDB is unavailable", async () => {
    breakIndexedDb("missing");
    localStorage.setItem(performPositionKey(USER_A, "s1"), "{}");
    await wipeAll();
    expect(localStorage.getItem(performPositionKey(USER_A, "s1"))).toBeNull();
  });
});
