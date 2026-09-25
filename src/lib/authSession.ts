import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import { isNetworkError } from "./networkErrors";

/**
 * The current user from the locally stored session.
 *
 * Unlike `supabase.auth.getUser()`, this doesn't ask the auth server, so it
 * keeps working offline. Use it for read paths that must survive a lost
 * connection (performance mode and what it loads). RLS still enforces access
 * on the server, so a client-side guard loses nothing by trusting the session.
 */
export async function getSessionUser(): Promise<User | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user ?? null;
}

/** How long a user-initiated sign-out waits for the auth server before signing out locally. */
export const SIGN_OUT_SERVER_TIMEOUT_MS = 3000;

/** The part of supabase.auth that sign-out uses; `_removeSession` is auth-js internal (2.70). */
export interface SignOutAuth {
  signOut: () => Promise<{ error: unknown }>;
  _removeSession?: () => Promise<void>;
  storageKey?: string;
}

/**
 * User-initiated sign-out that always ends signed out on this device.
 *
 * auth-js 2.70 `signOut()` POSTs `/logout` (every scope, `"local"` too) and,
 * when that fails on the network, returns `{ error }` **without** removing the
 * stored session; with an expired token offline it can also wait ≈25 s first.
 * So: offline, or when the server call fails on the network or takes longer
 * than 3 s, the stored session is removed locally with auth-js's own
 * `_removeSession()` (clears the token and emits `SIGNED_OUT`). The refresh
 * token then stays valid on the server until it expires; the device is signed
 * out and its offline copies are already wiped. An HTTP error from the server
 * is rethrown and the user stays signed in.
 */
export async function signOutEverywhereOrLocally(
  auth: SignOutAuth = supabase.auth as unknown as SignOutAuth,
  opts: { isOnline?: () => boolean; timeoutMs?: number } = {}
): Promise<void> {
  const isOnline = opts.isOnline ?? (() => navigator.onLine);
  if (!isOnline()) {
    await removeLocalSession(auth);
    return;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), opts.timeoutMs ?? SIGN_OUT_SERVER_TIMEOUT_MS);
  });
  const outcome = await Promise.race([
    auth.signOut().then(
      ({ error }) => ({ error }),
      (error: unknown) => ({ error })
    ),
    timedOut,
  ]);
  clearTimeout(timer);

  if (outcome === "timeout" || isNetworkError(outcome.error)) {
    await removeLocalSession(auth);
    return;
  }
  if (outcome.error) throw outcome.error;
}

async function removeLocalSession(auth: SignOutAuth): Promise<void> {
  if (typeof auth._removeSession === "function") {
    await auth._removeSession();
    return;
  }
  // A future auth-js without _removeSession: drop the stored token and reload
  // so the client starts with no session.
  if (auth.storageKey) localStorage.removeItem(auth.storageKey);
  window.location.reload();
}
