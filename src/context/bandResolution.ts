import type { Band } from "../services/bandsService";
import { BandStorage } from "../lib/BandStorage";
import { isNetworkError } from "../lib/networkErrors";
import type { AppUser, AuthMode } from "./offlineAuthController";

export interface ResolveBandsDeps {
  user: AppUser | null;
  authMode: AuthMode;
  getMyBands: (userId: string) => Promise<Band[]>;
  listOfflineBands: () => Promise<Band[]>;
  /** Called when the server couldn't be reached (BandContext: reportNetworkFailure). */
  onNetworkFailure: () => void;
  /** Called when the server answered (BandContext: reportNetworkSuccess, resets the backoff). */
  onNetworkSuccess?: () => void;
}

export interface ResolvedBands {
  bands: Band[];
  /** "error": the server answered with an error; the no-band UI shows, no offline fallback. */
  source: "server" | "offline" | "error";
}

/**
 * Which bands the user has (spec §7.2), plain so it can be tested without React:
 * - "offline-cached": from offline copies, no request.
 * - "session": from the server; a **network** failure (weak signal, offline,
 *   timeout) falls back to offline copies. An HTTP error does not: the server
 *   answered, so the offline copies would hide a real problem.
 *
 * Never rejects, and never reads the session again (the uid comes from
 * `user`), so band resolution can't wait on a second getSession().
 */
export async function resolveBands(deps: ResolveBandsDeps): Promise<ResolvedBands> {
  const { user, authMode } = deps;
  if (!user) return { bands: [], source: "server" };
  if (authMode === "offline-cached") return { bands: await safeOfflineBands(deps), source: "offline" };
  try {
    const bands = await deps.getMyBands(user.id);
    deps.onNetworkSuccess?.();
    return { bands, source: "server" };
  } catch (error) {
    if (!isNetworkError(error)) {
      console.error("Could not load bands:", error);
      return { bands: [], source: "error" };
    }
    deps.onNetworkFailure();
    return { bands: await safeOfflineBands(deps), source: "offline" };
  }
}

async function safeOfflineBands(deps: ResolveBandsDeps): Promise<Band[]> {
  try {
    return await deps.listOfflineBands();
  } catch {
    // listOfflineBands never rejects; this only guards the unexpected.
    return [];
  }
}

/** Picks the saved band, else the only one, else none (§7.2). */
export function pickBand(bands: Band[]): Band | null {
  const savedBandId = BandStorage.getSelectedBandId();
  const saved = savedBandId ? bands.find((b) => String(b.id) === savedBandId) : undefined;
  return saved ?? (bands.length === 1 ? bands[0] : null);
}
