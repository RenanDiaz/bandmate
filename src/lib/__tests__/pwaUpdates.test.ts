import { describe, expect, it, vi } from "vitest";
import { PwaUpdater, RESUME_CHECK_INTERVAL_MS, type WorkboxLike } from "../pwaUpdates";

interface FakeRegistration {
  waiting: object | null;
  installing: object | null;
}

function setup(options: { online?: boolean; installed?: boolean } = {}) {
  const registration: FakeRegistration = { waiting: null, installing: null };
  let onWaiting = () => {};
  let onControlling: (isUpdate: boolean) => void = () => {};
  let online = options.online ?? true;
  let now = 1_000_000;
  const workbox = {
    onWaiting: (listener: () => void) => {
      onWaiting = listener;
    },
    onControlling: (listener: (isUpdate: boolean) => void) => {
      onControlling = listener;
    },
    register: vi.fn(async () => registration as unknown as ServiceWorkerRegistration),
    update: vi.fn(async () => {}),
    messageSkipWaiting: vi.fn(),
  } satisfies WorkboxLike;
  const reload = vi.fn();
  const waitForInstalled = vi.fn(async () => options.installed ?? true);
  const updater = new PwaUpdater({
    workbox,
    reload,
    isOnline: () => online,
    now: () => now,
    waitForInstalled,
  });
  return {
    updater,
    workbox,
    registration,
    reload,
    waitForInstalled,
    fireWaiting: () => onWaiting(),
    fireControlling: (isUpdate: boolean) => onControlling(isUpdate),
    setOnline: (value: boolean) => {
      online = value;
    },
    advance: (ms: number) => {
      now += ms;
    },
  };
}

async function started(options?: Parameters<typeof setup>[0]) {
  const ctx = setup(options);
  ctx.updater.start();
  await Promise.resolve();
  await Promise.resolve();
  return ctx;
}

describe("PwaUpdater", () => {
  it("registers once", async () => {
    const { updater, workbox } = await started();
    updater.start();
    expect(workbox.register).toHaveBeenCalledTimes(1);
  });

  it("raises the prompt when a worker is waiting and hides it on dismiss", async () => {
    const { updater, fireWaiting } = await started();
    const listener = vi.fn();
    updater.subscribe(listener);
    fireWaiting();
    expect(updater.getNeedRefresh()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    updater.dismiss();
    expect(updater.getNeedRefresh()).toBe(false);
  });

  it("reports up-to-date when the check finds nothing", async () => {
    const { updater, workbox } = await started();
    await expect(updater.checkForUpdate()).resolves.toBe("up-to-date");
    expect(workbox.update).toHaveBeenCalledTimes(1);
  });

  it("reports update-ready without a network call when a worker is already waiting", async () => {
    const { updater, workbox, fireWaiting } = await started();
    fireWaiting();
    await expect(updater.checkForUpdate()).resolves.toBe("update-ready");
    expect(workbox.update).not.toHaveBeenCalled();
  });

  it("waits for a found update to install", async () => {
    const ctx = await started();
    ctx.workbox.update.mockImplementation(async () => {
      ctx.registration.installing = {};
    });
    await expect(ctx.updater.checkForUpdate()).resolves.toBe("update-ready");
    expect(ctx.waitForInstalled).toHaveBeenCalledTimes(1);
  });

  it("reports an error when the found update fails to install", async () => {
    const ctx = await started({ installed: false });
    ctx.workbox.update.mockImplementation(async () => {
      ctx.registration.installing = {};
    });
    await expect(ctx.updater.checkForUpdate()).resolves.toBe("error");
  });

  it("reports offline without calling update()", async () => {
    const { updater, workbox } = await started({ online: false });
    await expect(updater.checkForUpdate()).resolves.toBe("offline");
    expect(workbox.update).not.toHaveBeenCalled();
  });

  it("reports offline or error when update() rejects", async () => {
    const ctx = await started();
    ctx.workbox.update.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(ctx.updater.checkForUpdate()).resolves.toBe("error");
    ctx.workbox.update.mockImplementationOnce(async () => {
      ctx.setOnline(false);
      throw new TypeError("Failed to fetch");
    });
    await expect(ctx.updater.checkForUpdate()).resolves.toBe("offline");
  });

  it("is unsupported without a service worker", async () => {
    const updater = new PwaUpdater({
      workbox: null,
      reload: vi.fn(),
      isOnline: () => true,
      now: () => 0,
      waitForInstalled: vi.fn(),
    });
    updater.start();
    await expect(updater.checkForUpdate()).resolves.toBe("unsupported");
  });

  it("shares one in-flight check", async () => {
    const { updater, workbox } = await started();
    const [a, b] = await Promise.all([updater.checkForUpdate(), updater.checkForUpdate()]);
    expect(a).toBe("up-to-date");
    expect(b).toBe("up-to-date");
    expect(workbox.update).toHaveBeenCalledTimes(1);
  });

  describe("checkOnResume", () => {
    it("checks once the interval since the last check has passed", async () => {
      const { updater, workbox, advance } = await started();
      updater.checkOnResume();
      expect(workbox.update).not.toHaveBeenCalled();
      advance(RESUME_CHECK_INTERVAL_MS);
      updater.checkOnResume();
      expect(workbox.update).toHaveBeenCalledTimes(1);
      await Promise.resolve();
      updater.checkOnResume();
      expect(workbox.update).toHaveBeenCalledTimes(1);
    });

    it("skips offline, before start and when a worker is already waiting", async () => {
      const idle = setup();
      idle.advance(RESUME_CHECK_INTERVAL_MS);
      idle.updater.checkOnResume();
      expect(idle.workbox.update).not.toHaveBeenCalled();

      const offline = await started({ online: false });
      offline.advance(RESUME_CHECK_INTERVAL_MS);
      offline.updater.checkOnResume();
      expect(offline.workbox.update).not.toHaveBeenCalled();

      const waiting = await started();
      waiting.fireWaiting();
      waiting.advance(RESUME_CHECK_INTERVAL_MS);
      waiting.updater.checkOnResume();
      expect(waiting.workbox.update).not.toHaveBeenCalled();
    });
  });

  describe("applyUpdate", () => {
    it("skips waiting and reloads once the new worker controls the page", async () => {
      const { updater, workbox, reload, fireWaiting, fireControlling } = await started();
      fireWaiting();
      updater.applyUpdate();
      expect(workbox.messageSkipWaiting).toHaveBeenCalledTimes(1);
      expect(reload).not.toHaveBeenCalled();
      fireControlling(true);
      expect(reload).toHaveBeenCalledTimes(1);
    });

    it("uses the registration's waiting worker when the event was missed", async () => {
      const { updater, workbox, registration } = await started();
      registration.waiting = {};
      updater.applyUpdate();
      expect(workbox.messageSkipWaiting).toHaveBeenCalledTimes(1);
    });

    it("reloads directly when nothing is waiting", async () => {
      const { updater, workbox, reload } = await started();
      updater.applyUpdate();
      expect(workbox.messageSkipWaiting).not.toHaveBeenCalled();
      expect(reload).toHaveBeenCalledTimes(1);
    });
  });

  it("only raises the prompt when another tab activates the update", async () => {
    const { updater, reload, fireControlling } = await started();
    fireControlling(false);
    expect(updater.getNeedRefresh()).toBe(false);
    fireControlling(true);
    expect(updater.getNeedRefresh()).toBe(true);
    expect(reload).not.toHaveBeenCalled();
  });
});
