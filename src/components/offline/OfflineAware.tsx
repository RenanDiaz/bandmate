import type { FC, ReactNode } from "react";
import { useOfflineUi } from "./useOfflineUi";

/**
 * Renders `offline` instead of the route's online view while `useOfflineUi()`
 * holds, so the online view is not mounted (no fetches, no error toasts).
 * Back online, the online view mounts for the same URL and loads as usual.
 */
export const OfflineAware: FC<{ offline: ReactNode; children: ReactNode }> = ({ offline, children }) => (
  <>{useOfflineUi() ? offline : children}</>
);
