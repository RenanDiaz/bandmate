import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

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
