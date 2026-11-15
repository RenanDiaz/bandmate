import { supabase } from "../lib/supabaseClient";

/**
 * The signed-in account's own name (docs/specs/member-names.md §1.4), stored
 * as `full_name` in the user metadata, the key Google fills, so every place
 * that reads names picks it up. Blank clears it. Email-and-password accounts
 * only: Google rewrites `full_name` on each sign-in.
 */
export async function updateAccountName(name: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() || null } });
  if (error) throw error;
}
