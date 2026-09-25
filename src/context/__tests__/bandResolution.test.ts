import { beforeEach, describe, expect, it, vi } from "vitest";

// Supabase double for the real getMyBands: getSession() hangs (token near
// expiry, weak signal: auth-js would retry the refresh for ≈25 s) and every
// PostgREST request fails on the network.
const fakeSupabase = vi.hoisted(() => {
  const fetchFailure = { message: "TypeError: Failed to fetch", details: "", hint: "", code: "" };
  const query = {
    select: () => query,
    eq: () => Promise.resolve({ data: null, error: fetchFailure, status: 0 }),
  };
  return {
    auth: { getSession: vi.fn(() => new Promise<never>(() => {})), getUser: vi.fn(() => new Promise<never>(() => {})) },
    from: vi.fn(() => query),
  };
});
vi.mock("../../lib/supabaseClient", () => ({ supabase: fakeSupabase }));

import { getMyBands } from "../../services/bandsService";
import * as offline from "../../services/offlineSetlistService";
import { offlineKeys } from "../../lib/offlineStore";
import { BandStorage } from "../../lib/BandStorage";
import { pickBand, resolveBands } from "../bandResolution";
import type { ResolveBandsDeps } from "../bandResolution";
import type { AppUser } from "../offlineAuthController";
import { resetOfflineTestEnv, seedRaw, snapshotRecords, storeMeta } from "../../test/offlineFixtures";

const USER_A = "user-a";
const sessionUser: AppUser = { id: USER_A, email: "a@example.com" };

/** What postgrest-js returns when fetch() itself rejects (PostgrestBuilder, status 0). */
const postgrestFetchFailure = () => ({
  message: "TypeError: Failed to fetch",
  details: "TypeError: Failed to fetch\n    at …",
  hint: "",
  code: "",
});

beforeEach(async () => {
  resetOfflineTestEnv();
  vi.spyOn(console, "log").mockImplementation(() => {}); // BandStorage logs
  vi.spyOn(console, "error").mockImplementation(() => {});
  // A downloaded setlist of band 7, owned by A, and band 7 saved as selected.
  await seedRaw({
    ...storeMeta(),
    ...snapshotRecords({ userId: USER_A, setlistId: "s1", bandId: 7 }),
    [offlineKeys.lastUser]: USER_A,
  });
  offline.setOfflineCurrentUser(USER_A);
  BandStorage.setSelectedBandId(7);
});

function deps(overrides: Partial<ResolveBandsDeps>): ResolveBandsDeps {
  return {
    user: sessionUser,
    authMode: "session",
    getMyBands: vi.fn(async () => []),
    listOfflineBands: vi.fn(offline.listOfflineBands),
    onNetworkFailure: vi.fn(),
    ...overrides,
  };
}

describe("§7.2 weak signal: session + getMyBands network failure", () => {
  it("resolves the stored band from offline copies", async () => {
    const d = deps({ getMyBands: vi.fn(async () => Promise.reject(postgrestFetchFailure())) });
    // resolveBands settling is what lets BandContext's finally() clear isResolvingBand.
    const result = await resolveBands(d);
    expect(result.source).toBe("offline");
    expect(result.bands.map((b) => b.id)).toEqual([7]);
    expect(pickBand(result.bands)?.id).toBe(7);
    expect(d.getMyBands).toHaveBeenCalledWith(USER_A);
    expect(d.onNetworkFailure).toHaveBeenCalledTimes(1);
  });

  it("doesn't wait on getSession(): real getMyBands, getSession hanging, network error", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const result = await resolveBands(deps({ getMyBands }));
      expect(result.source).toBe("offline");
      expect(result.bands.map((b) => b.id)).toEqual([7]);
      expect(fakeSupabase.from).toHaveBeenCalledWith("band_members");
      // Resolved with no timer advanced and without ever asking for the session.
      expect(fakeSupabase.auth.getSession).not.toHaveBeenCalled();
      expect(fakeSupabase.auth.getUser).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("an HTTP error (401) keeps the error UI: no offline fallback", async () => {
    const d = deps({
      getMyBands: vi.fn(async () =>
        Promise.reject({ message: "JWT expired", details: null, hint: null, code: "PGRST301" })
      ),
    });
    const result = await resolveBands(d);
    expect(result).toEqual({ bands: [], source: "error" });
    expect(d.listOfflineBands).not.toHaveBeenCalled();
    expect(d.onNetworkFailure).not.toHaveBeenCalled();
  });

  it("offline-cached reads offline copies without a request", async () => {
    const d = deps({ authMode: "offline-cached", user: { id: USER_A, offlineCached: true } });
    const result = await resolveBands(d);
    expect(result.bands.map((b) => b.id)).toEqual([7]);
    expect(d.getMyBands).not.toHaveBeenCalled();
  });

  it("no user → no bands", async () => {
    expect(await resolveBands(deps({ user: null }))).toEqual({ bands: [], source: "server" });
  });
});
