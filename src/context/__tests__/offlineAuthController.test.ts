import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { AuthRetryableFetchError } from "@supabase/supabase-js";
import {
  GET_SESSION_OFFLINE_TIMEOUT_MS,
  OfflineAuthController,
  isOfflineUser,
  performUserSignOut,
} from "../offlineAuthController";
import type { AuthControllerDeps } from "../offlineAuthController";
import * as offline from "../../services/offlineSetlistService";
import { offlineKeys } from "../../lib/offlineStore";
import { performPositionKey } from "../../lib/performPosition";
import { flush, rawKeys, resetOfflineTestEnv, seedRaw, snapshotRecords, storeMeta } from "../../test/offlineFixtures";

const USER_A = "user-a";
const USER_B = "user-b";

type GetSessionResult = { data: { session: Session | null }; error: unknown };

function user(id: string): User {
  return { id, email: `${id}@example.com`, app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "" };
}

function session(id: string): Session {
  return {
    access_token: "t",
    refresh_token: "r",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: user(id),
  };
}

const retryable = () => new AuthRetryableFetchError("Failed to fetch", 0);

/** Supabase auth double: getSession answers what each test decides, events are emitted by hand. */
function createFakeAuth() {
  let callback: ((event: AuthChangeEvent, session: Session | null) => void) | null = null;
  const pending: Array<(r: GetSessionResult) => void> = [];
  const auth = {
    getSession: vi.fn(
      () =>
        new Promise<GetSessionResult>((resolve) => {
          pending.push(resolve);
        })
    ),
    getUser: vi.fn(async () => ({ data: { user: null as User | null }, error: null })),
    onAuthStateChange: vi.fn((cb: (event: AuthChangeEvent, session: Session | null) => void) => {
      callback = cb;
      return { data: { subscription: { unsubscribe: () => (callback = null) } } };
    }),
    signOut: vi.fn(async () => {
      callback?.("SIGNED_OUT", null);
      return { error: null };
    }),
  };
  return {
    auth,
    /** Resolves the oldest unanswered getSession() call. */
    answer(result: GetSessionResult) {
      const resolve = pending.shift();
      if (!resolve) throw new Error("no pending getSession()");
      resolve(result);
    },
    /** Resolves the oldest unanswered getSession() call after `ms` (fake) milliseconds. */
    answerAfter(ms: number, result: GetSessionResult) {
      const resolve = pending.shift();
      if (!resolve) throw new Error("no pending getSession()");
      setTimeout(() => resolve(result), ms);
    },
    emit(event: AuthChangeEvent, s: Session | null) {
      callback?.(event, s);
    },
  };
}

function setup(opts: { online: boolean }) {
  const fake = createFakeAuth();
  let online = opts.online;
  const confirmSpy = vi.spyOn(offline, "confirmSignedInUser");
  const setCurrentSpy = vi.spyOn(offline, "setOfflineCurrentUser");
  const deps: AuthControllerDeps = {
    auth: fake.auth,
    offline: {
      getLastUserId: offline.getLastUserId,
      confirmSignedInUser: (id) => offline.confirmSignedInUser(id),
      setOfflineCurrentUser: (id) => offline.setOfflineCurrentUser(id),
    },
    isOnline: () => online,
    reportNetworkFailure: vi.fn(),
    onConfirmedSignedOut: vi.fn(),
  };
  const controller = new OfflineAuthController(deps);
  controllers.push(controller);
  return {
    fake,
    deps,
    controller,
    confirmSpy,
    setCurrentSpy,
    setOnline: (value: boolean) => (online = value),
    state: () => controller.getState(),
  };
}

const controllers: OfflineAuthController[] = [];

/** A has one downloaded setlist, and `last-user` is A. */
async function seedUserA() {
  await seedRaw({
    ...storeMeta(),
    ...snapshotRecords({ userId: USER_A, setlistId: "a1" }),
    [offlineKeys.lastUser]: USER_A,
  });
}

beforeEach(async () => {
  resetOfflineTestEnv();
});

afterEach(() => {
  controllers.splice(0).forEach((c) => c.stop());
  vi.useRealTimers();
});

describe("A1: network-failed refresh → offline-cached", () => {
  it("resolves offline-cached from last-user with nothing deleted (navigator.onLine true)", async () => {
    await seedUserA();
    const before = await rawKeys();
    const t = setup({ online: true });
    t.controller.start();
    t.fake.answer({ data: { session: null }, error: retryable() });
    await flush();

    expect(t.state()).toMatchObject({ authMode: "offline-cached", isCheckingAuth: false, provisional: false });
    expect(t.state().user?.id).toBe(USER_A);
    expect(isOfflineUser(t.state().user)).toBe(true);
    expect(t.deps.reportNetworkFailure).toHaveBeenCalled();
    expect(t.confirmSpy).not.toHaveBeenCalled();
    expect((await offline.listSnapshots()).map((m) => m.setlistId)).toEqual(["a1"]);
    expect(await rawKeys()).toEqual(before);
    expect(t.deps.onConfirmedSignedOut).not.toHaveBeenCalled();
  });

  it("ignores INITIAL_SESSION without a session while offline-cached", async () => {
    await seedUserA();
    const t = setup({ online: true });
    t.controller.start();
    t.fake.answer({ data: { session: null }, error: retryable() });
    await flush();
    t.fake.emit("INITIAL_SESSION", null);
    await flush();
    expect(t.state().authMode).toBe("offline-cached");
  });
});

describe("A1: involuntary SIGNED_OUT → session-lost (hide, never wipe)", () => {
  it("hides on SIGNED_OUT, restores on same-uid sign-in without a download", async () => {
    await seedUserA();
    const t = setup({ online: true });
    t.controller.start();
    t.fake.answer({ data: { session: session(USER_A) }, error: null });
    await flush();
    expect(t.state().authMode).toBe("session");
    expect(await offline.listSnapshots()).toHaveLength(1);
    const before = await rawKeys();

    t.fake.emit("SIGNED_OUT", null);
    await flush();
    expect(t.state()).toMatchObject({ authMode: "session-lost", user: null });
    expect(await offline.listSnapshots()).toEqual([]);
    expect(await rawKeys()).toEqual(before); // file:, snapshot*, last-user all still there
    expect(await offline.getLastUserId()).toBe(USER_A);
    expect(await offline.countHiddenSnapshots(USER_A)).toBe(1);
    expect(t.deps.onConfirmedSignedOut).not.toHaveBeenCalled();

    t.fake.emit("SIGNED_IN", session(USER_A));
    await flush();
    expect(t.state().authMode).toBe("session");
    expect((await offline.listSnapshots()).map((m) => m.setlistId)).toEqual(["a1"]);
    expect(await rawKeys()).toEqual(before);
  });

  it("wipes before a different uid becomes current", async () => {
    await seedUserA();
    const t = setup({ online: true });
    t.controller.start();
    t.fake.answer({ data: { session: session(USER_A) }, error: null });
    await flush();
    t.fake.emit("SIGNED_OUT", null);
    await flush();

    const order: string[] = [];
    t.setCurrentSpy.mockClear();
    const wipedBeforeVisible = vi.fn();
    offline.subscribe((e) => {
      if (e.type === "store-wiped") order.push(`wiped:${e.reason}`);
      if (e.type === "visibility-changed") order.push(`visible:${offline.getOfflineCurrentUser()}`);
    });
    t.controller.subscribe((s) => {
      if (s.user?.id === USER_B) wipedBeforeVisible(order.includes("wiped:user-changed"));
    });

    t.fake.emit("SIGNED_IN", session(USER_B));
    await flush();

    expect(order).toEqual(["wiped:user-changed", `visible:${USER_B}`]);
    expect(wipedBeforeVisible).toHaveBeenCalledWith(true);
    expect(t.state()).toMatchObject({ authMode: "session" });
    expect(t.state().user?.id).toBe(USER_B);
    expect(await rawKeys()).toEqual([offlineKeys.lastUser, offlineKeys.meta]);
    expect(await offline.getLastUserId()).toBe(USER_B);
  });

  it("a null getSession() online (no stored session) hides instead of deleting", async () => {
    await seedUserA();
    const before = await rawKeys();
    const t = setup({ online: true });
    t.controller.start();
    t.fake.answer({ data: { session: null }, error: null });
    await flush();
    expect(t.state()).toMatchObject({ authMode: "session-lost", user: null, isCheckingAuth: false });
    expect(await rawKeys()).toEqual(before);
  });

  it("no session and no last-user → signed-out (confirmed)", async () => {
    const t = setup({ online: true });
    t.controller.start();
    t.fake.answer({ data: { session: null }, error: null });
    await flush();
    expect(t.state()).toMatchObject({ authMode: "signed-out", user: null, isCheckingAuth: false });
    expect(t.deps.onConfirmedSignedOut).toHaveBeenCalled();
  });
});

describe("A6: offline, getSession() raced against 1.5 s", () => {
  async function startOfflineWithHangingSession(lateResult: GetSessionResult) {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const t = setup({ online: false });
    t.controller.start();
    t.fake.answerAfter(25_000, lateResult);
    await flush();
    return t;
  }

  it("resolves offline-cached from last-user within 1.5 s, provisionally, with no side effects", async () => {
    await seedUserA();
    const before = await rawKeys();
    const t = await startOfflineWithHangingSession({ data: { session: null }, error: retryable() });

    vi.advanceTimersByTime(GET_SESSION_OFFLINE_TIMEOUT_MS - 1);
    await flush();
    expect(t.state().isCheckingAuth).toBe(true);

    vi.advanceTimersByTime(1);
    await flush();
    expect(t.state()).toMatchObject({ authMode: "offline-cached", isCheckingAuth: false, provisional: true });
    expect(t.state().user?.id).toBe(USER_A);
    expect((await offline.listSnapshots()).map((m) => m.setlistId)).toEqual(["a1"]);
    // A provisional state never runs confirmed-state side effects.
    expect(t.confirmSpy).not.toHaveBeenCalled();
    expect(t.deps.onConfirmedSignedOut).not.toHaveBeenCalled();
    expect(await rawKeys()).toEqual(before);
  });

  it("late AuthRetryableFetchError → stays offline-cached, same user reference", async () => {
    await seedUserA();
    const t = await startOfflineWithHangingSession({ data: { session: null }, error: retryable() });
    vi.advanceTimersByTime(GET_SESSION_OFFLINE_TIMEOUT_MS);
    await flush();
    const provisionalUser = t.state().user;

    vi.advanceTimersByTime(25_000);
    await flush();
    expect(t.state()).toMatchObject({ authMode: "offline-cached", provisional: false });
    expect(t.state().user).toBe(provisionalUser);
    expect(t.confirmSpy).not.toHaveBeenCalled();
  });

  it("late session for the same uid → session, nothing wiped", async () => {
    await seedUserA();
    const before = await rawKeys();
    const t = await startOfflineWithHangingSession({ data: { session: session(USER_A) }, error: null });
    vi.advanceTimersByTime(GET_SESSION_OFFLINE_TIMEOUT_MS);
    await flush();
    vi.advanceTimersByTime(25_000);
    await flush();
    expect(t.state()).toMatchObject({ authMode: "session", provisional: false });
    expect(isOfflineUser(t.state().user)).toBe(false);
    expect(t.confirmSpy).toHaveBeenCalledWith(USER_A);
    expect(await rawKeys()).toEqual(before);
  });

  it("late session for another uid → wipe, then session", async () => {
    await seedUserA();
    const t = await startOfflineWithHangingSession({ data: { session: session(USER_B) }, error: null });
    vi.advanceTimersByTime(GET_SESSION_OFFLINE_TIMEOUT_MS);
    await flush();
    vi.advanceTimersByTime(25_000);
    await flush();
    expect(t.state().user?.id).toBe(USER_B);
    expect(await rawKeys()).toEqual([offlineKeys.lastUser, offlineKeys.meta]);
  });

  it("late null without a retryable error → session-lost, nothing deleted", async () => {
    await seedUserA();
    const before = await rawKeys();
    const t = await startOfflineWithHangingSession({ data: { session: null }, error: null });
    vi.advanceTimersByTime(GET_SESSION_OFFLINE_TIMEOUT_MS);
    await flush();
    vi.advanceTimersByTime(25_000);
    await flush();
    expect(t.state()).toMatchObject({ authMode: "session-lost", user: null });
    expect(await rawKeys()).toEqual(before);
    expect(t.deps.onConfirmedSignedOut).not.toHaveBeenCalled();
  });

  it("no last-user → keeps waiting for the real answer", async () => {
    const t = await startOfflineWithHangingSession({ data: { session: null }, error: retryable() });
    vi.advanceTimersByTime(GET_SESSION_OFFLINE_TIMEOUT_MS * 2);
    await flush();
    expect(t.state().isCheckingAuth).toBe(true);
    vi.advanceTimersByTime(25_000);
    await flush();
    expect(t.state()).toMatchObject({ authMode: "signed-out", isCheckingAuth: false });
  });

  it("a session that answers before the timeout is used directly", async () => {
    await seedUserA();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const t = setup({ online: false });
    t.controller.start();
    t.fake.answer({ data: { session: session(USER_A) }, error: null });
    await flush();
    expect(t.state()).toMatchObject({ authMode: "session", provisional: false });
  });

  it("recheck() when back online reconciles offline-cached", async () => {
    await seedUserA();
    const t = await startOfflineWithHangingSession({ data: { session: null }, error: retryable() });
    vi.advanceTimersByTime(GET_SESSION_OFFLINE_TIMEOUT_MS);
    await flush();
    t.setOnline(true);
    const rechecked = t.controller.recheck();
    t.fake.answer({ data: { session: session(USER_A) }, error: null });
    await rechecked;
    await flush();
    expect(t.state().authMode).toBe("session");
    // The stale 25 s answer must not override the newer one.
    vi.advanceTimersByTime(25_000);
    await flush();
    expect(t.state().authMode).toBe("session");
  });
});

describe("user-initiated sign-out", () => {
  it("wipes before signOut: store empty, position keys removed, signed-out", async () => {
    await seedUserA();
    localStorage.setItem(performPositionKey(USER_A, "a1"), "{}");
    const t = setup({ online: true });
    t.controller.start();
    t.fake.answer({ data: { session: session(USER_A) }, error: null });
    await flush();

    const storeKeysWhenSignOutRan: string[][] = [];
    t.fake.auth.signOut.mockImplementationOnce(async () => {
      storeKeysWhenSignOutRan.push(await rawKeys());
      t.fake.emit("SIGNED_OUT", null);
      return { error: null };
    });

    await performUserSignOut(offline.wipeAll, () => t.fake.auth.signOut());
    await flush();

    expect(storeKeysWhenSignOutRan).toEqual([[offlineKeys.meta]]);
    expect(await rawKeys()).toEqual([offlineKeys.meta]);
    expect(localStorage.getItem(performPositionKey(USER_A, "a1"))).toBeNull();
    expect(t.state()).toMatchObject({ authMode: "signed-out", user: null });
    expect(t.deps.onConfirmedSignedOut).toHaveBeenCalled();
    offline.setOfflineCurrentUser(USER_A);
    expect(await offline.listSnapshots()).toEqual([]);
  });
});
