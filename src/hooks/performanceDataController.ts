import { NoSnapshotError, PerformanceDataError } from "./performanceDataSource";
import type {
  PerformanceDataSource,
  PerformanceLoadError,
  PerformanceRows,
  PerformanceSession,
} from "./performanceDataSource";

/**
 * Source selection and session lifecycle for performance mode (spec §8.2),
 * as plain TypeScript so it is unit-tested without a DOM;
 * useSetlistPerformanceData is the React wrapper. One controller per mounted
 * setlist.
 *
 * With snapshots enabled (the offline-downloads flag, removed in PR 2.5):
 * 1. a snapshot of this setlist for the current user → snapshot source, even
 *    online (it refreshes its rows in the background itself);
 * 2. none and online → network source;
 * 3. none and offline → error "network" with `unavailableOffline`, which the
 *    view renders as "Not available offline" (no toast, no bounce, B8).
 * With them disabled, the network source only, as before PR 2.4.
 */

export interface PerformanceDataState {
  status: "loading" | "ready" | "error";
  error: PerformanceLoadError | null;
  rows: PerformanceRows | null;
  source: "network" | "snapshot";
  /** No offline copy and no connection (rule 3). */
  unavailableOffline: boolean;
}

export interface PerformanceDataControllerOptions {
  setlistId: string;
  /** isOfflineDownloadsEnabled(), read once per mount. */
  useSnapshots: boolean;
  isOnline: () => boolean;
  network: PerformanceDataSource;
  snapshot: PerformanceDataSource;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export class PerformanceDataController {
  private state: PerformanceDataState = {
    status: "loading",
    error: null,
    rows: null,
    source: "network",
    unavailableOffline: false,
  };
  private readonly listeners = new Set<() => void>();
  private readonly abort = new AbortController();
  private session: PerformanceSession | null = null;
  private unsubscribeSession: (() => void) | null = null;
  private disposed = false;
  private readonly options: PerformanceDataControllerOptions;

  constructor(options: PerformanceDataControllerOptions) {
    this.options = options;
    void this.start();
  }

  getState(): PerformanceDataState {
    return this.state;
  }

  /** The session the rows came from (null while loading or after an error). */
  getSession(): PerformanceSession | null {
    return this.state.status === "ready" ? this.session : null;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** The connection came back: the snapshot source refreshes its rows (A3). */
  onOnline(): void {
    if (this.state.status !== "ready" || this.state.source !== "snapshot") return;
    this.session?.refresh().catch(() => undefined);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    this.detach();
    this.listeners.clear();
  }

  private setState(next: PerformanceDataState): void {
    if (this.disposed) return;
    this.state = next;
    for (const listener of [...this.listeners]) listener();
  }

  private attach(source: PerformanceDataSource): { session: PerformanceSession; latest: () => PerformanceRows | null } {
    const session = source.open(this.options.setlistId);
    this.session = session;
    // An emit can land before load() resolves here (a fast background refresh):
    // keep the latest so it is not lost.
    let latest: PerformanceRows | null = null;
    this.unsubscribeSession = session.subscribe((rows) => {
      latest = rows;
      if (this.session !== session || this.state.status !== "ready") return;
      this.setState({ ...this.state, rows });
    });
    return { session, latest: () => latest };
  }

  private detach(): void {
    this.unsubscribeSession?.();
    this.unsubscribeSession = null;
    this.session?.close();
    this.session = null;
  }

  private async start(): Promise<void> {
    const { signal } = this.abort;
    const { useSnapshots, isOnline, network, snapshot } = this.options;

    if (useSnapshots) {
      const { session, latest } = this.attach(snapshot);
      try {
        const rows = await session.load(signal);
        if (signal.aborted) return;
        this.setState({ status: "ready", error: null, rows: latest() ?? rows, source: "snapshot", unavailableOffline: false });
        return;
      } catch (error) {
        if (signal.aborted || isAbortError(error)) return;
        this.detach();
        if (!(error instanceof NoSnapshotError)) console.error("Could not open the offline copy:", error);
        if (!isOnline()) {
          this.setState({ status: "error", error: "network", rows: null, source: "network", unavailableOffline: true });
          return;
        }
      }
    }

    const { session, latest } = this.attach(network);
    try {
      const rows = await session.load(signal);
      if (signal.aborted) return;
      this.setState({ status: "ready", error: null, rows: latest() ?? rows, source: "network", unavailableOffline: false });
    } catch (error) {
      if (signal.aborted || isAbortError(error)) return;
      console.error("Failed to load setlist:", error);
      this.detach();
      const code = error instanceof PerformanceDataError ? error.code : "network";
      this.setState({ status: "error", error: code, rows: null, source: "network", unavailableOffline: false });
    }
  }
}

export interface PerformanceCapabilities {
  canReorder: boolean;
  canUpload: boolean;
  canSync: boolean;
  canEditNotes: boolean;
}

/**
 * §8.3. Offline: nothing that writes or needs Realtime. Guests: no reorder,
 * upload or note editing, online too (closes the guest gap found in PR 2.1;
 * not behind the offline flag).
 */
export function performanceCapabilities({ role, isOnline }: { role: string | undefined; isOnline: boolean }): PerformanceCapabilities {
  const canEdit = role !== "guest" && isOnline;
  return { canReorder: canEdit, canUpload: canEdit, canEditNotes: canEdit, canSync: isOnline };
}
