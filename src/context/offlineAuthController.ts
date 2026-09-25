import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";

/**
 * Who the user is, including offline (spec §7.1, A1, A6). Plain TypeScript so
 * it can be tested without React; BandContext owns one instance and mirrors
 * its state.
 *
 * - "session": valid session; that uid's offline copies are visible.
 * - "offline-cached": no usable token and the refresh failed on the network
 *   (or getSession() hasn't answered within 1.5 s, online or not); `last-user`'s
 *   copies are visible. `user` is a minimal `OfflineUser`.
 * - "session-lost": no stored session, but `last-user` exists and never signed
 *   out; copies are HIDDEN, nothing is deleted.
 * - "signed-out": no session and no `last-user`.
 */
export type AuthMode = "session" | "offline-cached" | "session-lost" | "signed-out";

/** The user in `offline-cached`: only the id is known. */
export interface OfflineUser {
  id: string;
  offlineCached: true;
}

/**
 * The context's user. Only `id` is guaranteed: in "offline-cached" it is an
 * `OfflineUser` with nothing else, so every other field (email,
 * user_metadata, created_at…) is optional and the compiler makes consumers
 * handle it being missing.
 */
export type AppUser = { id: string; offlineCached?: true } & Partial<Omit<User, "id">>;

export function isOfflineUser(user: AppUser | null): user is OfflineUser {
  return !!user && (user as OfflineUser).offlineCached === true;
}

/** How long BandContext waits for getSession() before trusting `last-user` provisionally (A6), online or offline. */
export const GET_SESSION_OFFLINE_TIMEOUT_MS = 1500;

export interface AuthState {
  user: AppUser | null;
  authMode: AuthMode;
  isCheckingAuth: boolean;
  /**
   * True while `offline-cached` comes from the A6 timeout rather than an
   * actual getSession() answer. Informational: a provisional state runs no
   * confirmed-state side effects either way.
   */
  provisional: boolean;
}

type GetSessionResult = { data: { session: Session | null }; error: unknown };

export interface AuthControllerDeps {
  auth: {
    getSession: () => Promise<GetSessionResult>;
    getUser: () => Promise<{ data: { user: User | null }; error: unknown }>;
    onAuthStateChange: (
      callback: (event: AuthChangeEvent, session: Session | null) => void
    ) => { data: { subscription: { unsubscribe: () => void } } };
  };
  offline: {
    getLastUserId: () => Promise<string | null>;
    confirmSignedInUser: (userId: string) => Promise<{ wiped: boolean }>;
    /** `authenticated`: a valid session ("session"), which downloads require; false in "offline-cached". */
    setOfflineCurrentUser: (userId: string | null, opts?: { authenticated?: boolean }) => void;
  };
  isOnline: () => boolean;
  reportNetworkFailure: () => void;
  /** Runs when a confirmed state says nobody is signed in (BandContext clears the saved band). */
  onConfirmedSignedOut?: () => void;
  timeoutMs?: number;
}

// Set while AuthButton's user-initiated sign-out runs in this tab, so the
// SIGNED_OUT it causes is not mistaken for an involuntary one (§3.5 #6).
let userSignOutDepth = 0;

export function isUserSignOutInProgress(): boolean {
  return userSignOutDepth > 0;
}

/**
 * User-initiated sign-out (§3.5 #6a): `wipe` (offline copies) is awaited
 * before `signOut` runs. The only other wipe trigger is a confirmed sign-in
 * with a different uid.
 */
export async function performUserSignOut(wipe: () => Promise<void>, signOut: () => Promise<unknown>): Promise<void> {
  userSignOutDepth++;
  try {
    try {
      await wipe();
    } catch (error) {
      // Signing out still matters more; the next confirmed sign-in of another
      // uid wipes, and the owner filter hides the records until then.
      console.error("Offline wipe before sign-out failed:", error);
    }
    await signOut();
  } finally {
    userSignOutDepth--;
  }
}

async function safeGetSession(deps: AuthControllerDeps): Promise<GetSessionResult> {
  try {
    return await deps.auth.getSession();
  } catch (error) {
    return { data: { session: null }, error };
  }
}

export class OfflineAuthController {
  private state: AuthState = { user: null, authMode: "signed-out", isCheckingAuth: true, provisional: false };
  private listeners = new Set<(s: AuthState) => void>();
  private generation = 0;
  private stopped = false;
  private unsubscribeAuth: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly deps: AuthControllerDeps;

  constructor(deps: AuthControllerDeps) {
    this.deps = deps;
  }

  getState(): AuthState {
    return this.state;
  }

  subscribe(listener: (s: AuthState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(): void {
    const { data } = this.deps.auth.onAuthStateChange((event, session) => {
      void this.handleAuthEvent(event, session);
    });
    this.unsubscribeAuth = () => data.subscription.unsubscribe();
    void this.resolveInitial();
  }

  stop(): void {
    this.stopped = true;
    this.unsubscribeAuth?.();
    this.unsubscribeAuth = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.listeners.clear();
  }

  /**
   * Re-run getSession() (awaited): BandContext calls this when the device
   * comes back online in `offline-cached`. A session → "session"; a retryable
   * error → stay; anything else → "session-lost". Never deletes anything.
   */
  async recheck(): Promise<void> {
    const gen = ++this.generation;
    const lastUserPromise = this.deps.offline.getLastUserId();
    const result = await safeGetSession(this.deps);
    if (!this.isCurrent(gen)) return;
    await this.applySessionResult(gen, result, await lastUserPromise);
  }

  private isCurrent(gen: number): boolean {
    return !this.stopped && gen === this.generation;
  }

  private publish(next: Partial<AuthState>): void {
    if (this.stopped) return;
    const merged = { ...this.state, ...next };
    if (
      merged.user === this.state.user &&
      merged.authMode === this.state.authMode &&
      merged.isCheckingAuth === this.state.isCheckingAuth &&
      merged.provisional === this.state.provisional
    ) {
      return;
    }
    this.state = merged;
    for (const listener of [...this.listeners]) listener(this.state);
  }

  private async resolveInitial(): Promise<void> {
    const gen = this.generation;
    const lastUserPromise = this.deps.offline.getLastUserId();
    const sessionPromise = safeGetSession(this.deps);

    // With a token near expiry or expired, getSession() takes ≈25 s to give up
    // when the auth server can't be reached (§1). That happens on weak signal
    // too, where navigator.onLine is true, so the race runs online and
    // offline alike (A6): after the timeout, trust `last-user` provisionally.
    // A valid token answers in ≈0 ms and never reaches the timeout.
    const timeoutMs = this.deps.timeoutMs ?? GET_SESSION_OFFLINE_TIMEOUT_MS;
    const timedOut = new Promise<"timeout">((resolve) => {
      this.timer = setTimeout(() => resolve("timeout"), timeoutMs);
    });
    const first = await Promise.race([sessionPromise, timedOut]);
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (first === "timeout" && this.isCurrent(gen) && this.state.isCheckingAuth) {
      const lastUserId = await lastUserPromise;
      if (lastUserId && this.isCurrent(gen) && this.state.isCheckingAuth) {
        this.applyOfflineCached(lastUserId, true);
      }
      // No `last-user`: nothing on the device to show; wait for the real answer.
    }

    const result = await sessionPromise;
    if (!this.isCurrent(gen)) return;
    await this.applySessionResult(gen, result, await lastUserPromise);
  }

  /** Steps 1–4 of §7.1 for a getSession() answer. */
  private async applySessionResult(gen: number, result: GetSessionResult, lastUserId: string | null): Promise<void> {
    const session = result.data.session;
    if (session?.user) {
      await this.applyConfirmed(gen, session.user, { revalidate: true });
      return;
    }
    if (isAuthRetryableFetchError(result.error)) {
      // The refresh could not reach the auth server; auth-js kept the session.
      this.deps.reportNetworkFailure();
      if (lastUserId) this.applyOfflineCached(lastUserId, false);
      else this.applySignedOut(false);
      return;
    }
    if (lastUserId) this.applySessionLost();
    else this.applySignedOut(true);
  }

  private applyOfflineCached(lastUserId: string, provisional: boolean): void {
    const prev = this.state.user;
    const user: AppUser = prev?.id === lastUserId ? prev : { id: lastUserId, offlineCached: true };
    this.deps.offline.setOfflineCurrentUser(lastUserId, { authenticated: false });
    this.publish({ user, authMode: "offline-cached", isCheckingAuth: false, provisional });
  }

  private applySessionLost(): void {
    this.deps.offline.setOfflineCurrentUser(null);
    this.publish({ user: null, authMode: "session-lost", isCheckingAuth: false, provisional: false });
  }

  private applySignedOut(confirmed: boolean): void {
    this.deps.offline.setOfflineCurrentUser(null);
    this.publish({ user: null, authMode: "signed-out", isCheckingAuth: false, provisional: false });
    if (confirmed) this.deps.onConfirmedSignedOut?.();
  }

  /**
   * A confirmed session (§7.1 step 1): `confirmSignedInUser` (which wipes on
   * a uid change) runs before the user becomes current and before any list
   * can render.
   */
  private async applyConfirmed(gen: number, sessionUser: User, opts: { revalidate?: boolean } = {}): Promise<void> {
    await this.deps.offline.confirmSignedInUser(sessionUser.id);
    if (!this.isCurrent(gen)) return;
    const prev = this.state.user;
    // Keep the reference when only the token changed, so band data isn't
    // refetched on every TOKEN_REFRESHED (e.g. when the tab regains focus).
    const user = prev && !isOfflineUser(prev) && prev.id === sessionUser.id ? prev : sessionUser;
    this.deps.offline.setOfflineCurrentUser(sessionUser.id, { authenticated: true });
    this.publish({ user, authMode: "session", isCheckingAuth: false, provisional: false });

    // Only for getSession() answers, as before: auth events already come from the server.
    if (opts.revalidate && this.deps.isOnline()) void this.revalidate(gen, sessionUser.id);
  }

  /** getUser() asks the auth server; online only, and only ever to confirm a user. */
  private async revalidate(gen: number, sessionUserId: string): Promise<void> {
    try {
      const {
        data: { user: verified },
      } = await this.deps.auth.getUser();
      if (!verified || verified.id === sessionUserId || !this.isCurrent(gen)) return;
      await this.applyConfirmed(gen, verified);
    } catch {
      // Network hiccup: keep the session user.
    }
  }

  private async handleAuthEvent(event: AuthChangeEvent, session: Session | null): Promise<void> {
    if (session?.user) {
      // SIGNED_IN / TOKEN_REFRESHED / INITIAL_SESSION / USER_UPDATED with a session.
      const gen = ++this.generation;
      await this.applyConfirmed(gen, session.user);
      return;
    }
    if (event !== "SIGNED_OUT") {
      // INITIAL_SESSION without a session repeats what getSession() answers
      // (possibly a network failure); the getSession() path decides.
      return;
    }
    const gen = ++this.generation;
    if (isUserSignOutInProgress()) {
      this.applySignedOut(true);
      return;
    }
    // Involuntary: a refresh that failed with a non-retryable error, another
    // tab signing out, youtubeService's re-auth (C11). Hide, never wipe.
    const lastUserId = await this.deps.offline.getLastUserId();
    if (!this.isCurrent(gen)) return;
    if (lastUserId) this.applySessionLost();
    else this.applySignedOut(true);
  }
}
