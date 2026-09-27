import { Workbox } from "workbox-window";

// vite-plugin-pwa serves the worker from these URLs (`injectRegister: false`
// in vite.config.ts, so nothing else registers it). The dev worker is an ES
// module; the build emits a classic one.
const SW_URL = import.meta.env.DEV ? "/dev-sw.js?dev-sw" : "/sw.js";
const SW_TYPE = import.meta.env.DEV ? "module" : "classic";

/** Minimum time between two automatic checks (on resume / reconnect). */
export const RESUME_CHECK_INTERVAL_MS = 60_000;
/** How long a manual check waits for a found update to finish installing. */
export const INSTALL_TIMEOUT_MS = 30_000;

export type UpdateCheckResult =
  /** A new version is installed and waiting: `applyUpdate()` loads it. */
  | "update-ready"
  | "up-to-date"
  | "offline"
  /** No service worker in this browser (or not registered). */
  | "unsupported"
  | "error";

/** The part of workbox-window the updater uses (a fake in the tests). */
export interface WorkboxLike {
  onWaiting(listener: () => void): void;
  onControlling(listener: (isUpdate: boolean) => void): void;
  register(): Promise<ServiceWorkerRegistration | undefined>;
  update(): Promise<void>;
  messageSkipWaiting(): void;
}

export interface PwaUpdaterDeps {
  workbox: WorkboxLike | null;
  reload: () => void;
  isOnline: () => boolean;
  now: () => number;
  waitForInstalled: (worker: ServiceWorker, timeoutMs: number) => Promise<boolean>;
}

/**
 * Owns the service worker registration and the "new version" state
 * (`registerType: 'prompt'`). `PwaReloadPrompt` renders the state; the user
 * menu's "Check for updates" calls `checkForUpdate()`.
 *
 * Browsers look for a new worker on navigation, and an installed iOS app that
 * resumes from the background doesn't navigate — so without `checkOnResume()`
 * the prompt only appeared after killing the app. Nothing here reloads or
 * calls `skipWaiting` unless the user asks (`applyUpdate()`).
 */
export class PwaUpdater {
  private needRefresh = false;
  private hasWaiting = false;
  private reloadRequested = false;
  private started = false;
  private registration: ServiceWorkerRegistration | undefined;
  private lastCheckAt = Number.NEGATIVE_INFINITY;
  private inflight: Promise<UpdateCheckResult> | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly deps: PwaUpdaterDeps;

  constructor(deps: PwaUpdaterDeps) {
    this.deps = deps;
  }

  /** Registers the worker once; later calls do nothing. */
  start(): void {
    const wb = this.deps.workbox;
    if (this.started || !wb) return;
    this.started = true;

    wb.onWaiting(() => {
      this.hasWaiting = true;
      this.setNeedRefresh(true);
    });
    wb.onControlling((isUpdate) => {
      if (!isUpdate) return;
      this.hasWaiting = false;
      if (this.reloadRequested) {
        this.deps.reload();
      } else {
        // Another tab activated the new worker. This tab keeps running the old
        // bundle until the user chooses to reload.
        this.setNeedRefresh(true);
      }
    });

    // Registering checks for an update too.
    this.lastCheckAt = this.deps.now();
    wb.register()
      .then((registration) => {
        this.registration = registration;
      })
      .catch((error) => {
        console.error("Service worker registration failed", error);
      });
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getNeedRefresh = (): boolean => this.needRefresh;

  /** Hides the prompt; the waiting version stays for the next launch. */
  dismiss(): void {
    this.setNeedRefresh(false);
  }

  /** Asks the server for a new worker; resolves once it is known whether one is ready. */
  checkForUpdate(): Promise<UpdateCheckResult> {
    if (!this.inflight) {
      this.inflight = this.runCheck().finally(() => {
        this.inflight = null;
      });
    }
    return this.inflight;
  }

  /**
   * The app came back to the foreground or the connection returned: check
   * again, at most once per `RESUME_CHECK_INTERVAL_MS`. A found update raises
   * the prompt through the `waiting` event.
   */
  checkOnResume(): void {
    if (!this.started || this.inflight || this.hasWaiting) return;
    if (!this.deps.isOnline()) return;
    if (this.deps.now() - this.lastCheckAt < RESUME_CHECK_INTERVAL_MS) return;
    void this.checkForUpdate();
  }

  /** Activates the waiting version and reloads once it controls the page. */
  applyUpdate(): void {
    this.reloadRequested = true;
    const wb = this.deps.workbox;
    if (wb && (this.hasWaiting || this.registration?.waiting)) {
      // Reloads from the `controlling` listener once the new worker takes over.
      wb.messageSkipWaiting();
    } else {
      this.deps.reload();
    }
  }

  private async runCheck(): Promise<UpdateCheckResult> {
    const wb = this.deps.workbox;
    if (!wb || !this.started) return "unsupported";
    if (this.hasWaiting) return "update-ready";
    if (!this.deps.isOnline()) return "offline";

    this.lastCheckAt = this.deps.now();
    try {
      await wb.update();
    } catch {
      return this.deps.isOnline() ? "error" : "offline";
    }

    const registration = this.registration;
    if (this.hasWaiting || registration?.waiting) return "update-ready";
    const installing = registration?.installing;
    if (installing) {
      const installed = await this.deps.waitForInstalled(installing, INSTALL_TIMEOUT_MS);
      return installed ? "update-ready" : "error";
    }
    return "up-to-date";
  }

  private setNeedRefresh(value: boolean): void {
    if (this.needRefresh === value) return;
    this.needRefresh = value;
    this.listeners.forEach((listener) => listener());
  }
}

/** Resolves true once the worker is installed (or activated), false if it fails or times out. */
export function waitForInstalled(worker: ServiceWorker, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const settle = (value: boolean) => {
      clearTimeout(timer);
      worker.removeEventListener("statechange", onStateChange);
      resolve(value);
    };
    const onStateChange = () => {
      if (worker.state === "redundant") settle(false);
      else if (worker.state !== "installing") settle(true);
    };
    const timer = setTimeout(() => settle(false), timeoutMs);
    worker.addEventListener("statechange", onStateChange);
    onStateChange();
  });
}

function createWorkbox(): WorkboxLike {
  const wb = new Workbox(SW_URL, { scope: "/", type: SW_TYPE });
  wb.addEventListener("installed", (event) => {
    if (!event.isUpdate) console.log("App ready to work offline");
  });
  return {
    onWaiting: (listener) => wb.addEventListener("waiting", () => listener()),
    onControlling: (listener) => wb.addEventListener("controlling", (event) => listener(Boolean(event.isUpdate))),
    register: () => wb.register(),
    update: () => wb.update(),
    messageSkipWaiting: () => wb.messageSkipWaiting(),
  };
}

let instance: PwaUpdater | null = null;

/** The app's one updater. Without service worker support every check is `unsupported`. */
export function getPwaUpdater(): PwaUpdater {
  if (instance) return instance;
  const supported = typeof navigator !== "undefined" && "serviceWorker" in navigator;
  const updater = new PwaUpdater({
    workbox: supported ? createWorkbox() : null,
    reload: () => window.location.reload(),
    isOnline: () => navigator.onLine !== false,
    now: () => Date.now(),
    waitForInstalled,
  });
  if (supported) {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") updater.checkOnResume();
    });
    window.addEventListener("online", () => updater.checkOnResume());
  }
  instance = updater;
  return updater;
}
