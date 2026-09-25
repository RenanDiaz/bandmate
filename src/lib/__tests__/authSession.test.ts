import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { AuthApiError } from "@supabase/supabase-js";

// The real client needs VITE_SUPABASE_URL; these tests pass their own auth double.
vi.mock("../supabaseClient", () => ({ supabase: { auth: {} } }));

import { SIGN_OUT_SERVER_TIMEOUT_MS, signOutEverywhereOrLocally } from "../authSession";
import type { SignOutAuth } from "../authSession";
import { OfflineAuthController, performUserSignOut } from "../../context/offlineAuthController";
import * as offline from "../../services/offlineSetlistService";
import { offlineKeys } from "../../lib/offlineStore";
import { performPositionKey } from "../performPosition";
import { flush, rawKeys, resetOfflineTestEnv, seedRaw, snapshotRecords, storeMeta } from "../../test/offlineFixtures";

const USER_A = "user-a";
const STORAGE_KEY = "sb-test-auth-token";

function session(id: string): Session {
  return {
    access_token: "t",
    refresh_token: "r",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: { id, email: `${id}@example.com`, app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "" },
  };
}

/**
 * auth-js double with the 2.70 behaviour under test: `signOut` does whatever the
 * test says (a network error returns `{ error }` and keeps the session), and
 * `_removeSession` removes the stored token and emits SIGNED_OUT.
 */
function createAuth(signOut: SignOutAuth["signOut"]) {
  let callback: ((event: AuthChangeEvent, s: Session | null) => void) | null = null;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session(USER_A)));
  const auth = {
    signOut: vi.fn(signOut),
    _removeSession: vi.fn(async () => {
      localStorage.removeItem(STORAGE_KEY);
      callback?.("SIGNED_OUT", null);
    }),
    storageKey: STORAGE_KEY,
    getSession: vi.fn(async () => ({
      data: { session: localStorage.getItem(STORAGE_KEY) ? session(USER_A) : null },
      error: null,
    })),
    getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    onAuthStateChange: vi.fn((cb: (event: AuthChangeEvent, s: Session | null) => void) => {
      callback = cb;
      return { data: { subscription: { unsubscribe: () => (callback = null) } } };
    }),
  };
  return auth;
}

async function signedInController(auth: ReturnType<typeof createAuth>) {
  const controller = new OfflineAuthController({
    auth,
    offline: {
      getLastUserId: offline.getLastUserId,
      confirmSignedInUser: (id) => offline.confirmSignedInUser(id),
      setOfflineCurrentUser: (id) => offline.setOfflineCurrentUser(id),
    },
    isOnline: () => true,
    reportNetworkFailure: vi.fn(),
  });
  controllers.push(controller);
  controller.start();
  await flush();
  expect(controller.getState().authMode).toBe("session");
  return controller;
}

const controllers: OfflineAuthController[] = [];

beforeEach(async () => {
  resetOfflineTestEnv();
  await seedRaw({
    ...storeMeta(),
    ...snapshotRecords({ userId: USER_A, setlistId: "a1" }),
    [offlineKeys.lastUser]: USER_A,
  });
  localStorage.setItem(performPositionKey(USER_A, "a1"), "{}");
});

afterEach(() => {
  controllers.splice(0).forEach((c) => c.stop());
  vi.useRealTimers();
});

describe("user sign-out always ends signed out locally", () => {
  it("signOut() fails on the network → wiped, local session removed, signed-out", async () => {
    // auth-js 2.70: a /logout network failure returns { error } without removing the session.
    const auth = createAuth(async () => ({ error: new TypeError("Failed to fetch") }));
    const controller = await signedInController(auth);

    await performUserSignOut(offline.wipeAll, () => signOutEverywhereOrLocally(auth, { isOnline: () => true }));
    await flush();

    expect(auth.signOut).toHaveBeenCalled();
    expect(auth._removeSession).toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(await rawKeys()).toEqual([offlineKeys.meta]);
    expect(localStorage.getItem(performPositionKey(USER_A, "a1"))).toBeNull();
    // Recognized as user-initiated (not session-lost): last-user was wiped too.
    expect(controller.getState()).toMatchObject({ authMode: "signed-out", user: null });
  });

  it("signOut() hanging (expired token, weak signal) → local sign-out after the timeout", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const auth = createAuth(() => new Promise(() => {}));
    const controller = await signedInController(auth);

    const done = performUserSignOut(offline.wipeAll, () => signOutEverywhereOrLocally(auth, { isOnline: () => true }));
    await flush();
    expect(auth._removeSession).not.toHaveBeenCalled();
    vi.advanceTimersByTime(SIGN_OUT_SERVER_TIMEOUT_MS);
    await done;
    await flush();

    expect(auth._removeSession).toHaveBeenCalled();
    expect(controller.getState()).toMatchObject({ authMode: "signed-out", user: null });
  });

  it("offline → removes the local session without calling the server", async () => {
    const auth = createAuth(async () => ({ error: null }));
    await signedInController(auth);
    await performUserSignOut(offline.wipeAll, () => signOutEverywhereOrLocally(auth, { isOnline: () => false }));
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(auth._removeSession).toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("an HTTP error from the server is rethrown; the session stays", async () => {
    const auth = createAuth(async () => ({ error: new AuthApiError("Internal error", 500, "unexpected_failure") }));
    const controller = await signedInController(auth);
    await expect(
      performUserSignOut(offline.wipeAll, () => signOutEverywhereOrLocally(auth, { isOnline: () => true }))
    ).rejects.toBeInstanceOf(AuthApiError);
    expect(auth._removeSession).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(controller.getState().authMode).toBe("session");
  });

  it("success → no local removal needed", async () => {
    const auth = createAuth(async () => {
      await auth._removeSession(); // what auth-js does on success
      return { error: null };
    });
    await signedInController(auth);
    await signOutEverywhereOrLocally(auth, { isOnline: () => true });
    expect(auth._removeSession).toHaveBeenCalledTimes(1);
  });
});

describe("auth-js internals that signOutEverywhereOrLocally relies on", () => {
  // `_removeSession` and `storageKey` are auth-js internals (2.70). A
  // supabase-js upgrade that renames or drops them must fail CI, not leave
  // offline sign-out silently falling back to a page reload.
  it("the installed client exposes _removeSession(), which clears the stored session and emits SIGNED_OUT", async () => {
    const { createClient } = await vi.importActual<typeof import("@supabase/supabase-js")>("@supabase/supabase-js");
    const memory = new Map<string, string>();
    const client = createClient("https://example.supabase.co", "anon-key", {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: true,
        storage: {
          getItem: (k) => memory.get(k) ?? null,
          setItem: (k, v) => void memory.set(k, v),
          removeItem: (k) => void memory.delete(k),
        },
      },
    });
    const auth = client.auth as unknown as SignOutAuth & { storageKey: string };
    expect(typeof auth._removeSession).toBe("function");
    expect(typeof auth.storageKey).toBe("string");

    memory.set(auth.storageKey, JSON.stringify(session(USER_A)));
    const events: AuthChangeEvent[] = [];
    const { data } = client.auth.onAuthStateChange((event) => {
      events.push(event);
    });
    await auth._removeSession!();
    data.subscription.unsubscribe();
    expect(memory.has(auth.storageKey)).toBe(false);
    expect(events).toContain("SIGNED_OUT");
  });
});
