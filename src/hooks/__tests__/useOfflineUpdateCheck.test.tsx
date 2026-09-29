// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";

vi.mock("../../services/offlineSetlistService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/offlineSetlistService")>()),
  checkForUpdates: vi.fn(async () => ({})),
  collectGarbage: vi.fn(async () => ({ deletedFiles: 0, freedBytes: 0 })),
}));
vi.mock("../../context/offlineDownloadController", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../context/offlineDownloadController")>();
  const resume = vi.fn(async () => ({ staleDiscarded: 0 }));
  return { ...actual, getOfflineDownloadController: () => ({ ...actual.getOfflineDownloadController(), resume }) };
});

import { checkForUpdates } from "../../services/offlineSetlistService";
import { bandContext, renderApp } from "../../test/renderApp";
import { useOfflineStartup } from "../useOfflineStartup";
import { ONLINE_CHECK_DEBOUNCE_MS, useOfflineUpdateCheckOnOpen } from "../useOfflineUpdateCheck";

/** PR 3.1, §6.3 triggers: app start, the connection returning (5 s debounce), opening a detail. */

const Startup = () => {
  useOfflineStartup();
  return null;
};
const Detail = ({ id }: { id: string }) => {
  useOfflineUpdateCheckOnOpen(id);
  return null;
};

/** Lets the resume → GC chain settle, then runs due timers. */
async function settle(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  vi.mocked(checkForUpdates).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useOfflineStartup: update check", () => {
  it("checks at once on app start with a session online", async () => {
    renderApp(<Startup />, { ctx: bandContext() });
    await settle();
    expect(checkForUpdates).toHaveBeenCalledTimes(1);
    expect(checkForUpdates).toHaveBeenCalledWith(undefined);
  });

  it("does not check offline-cached or offline", async () => {
    renderApp(<Startup />, { ctx: bandContext({ authMode: "offline-cached" }) });
    renderApp(<Startup />, { ctx: bandContext({ isOnline: false }) });
    await settle(ONLINE_CHECK_DEBOUNCE_MS * 2);
    expect(checkForUpdates).not.toHaveBeenCalled();
  });

  it("checks again 5 s after the connection returns, once for a flapping signal", async () => {
    const { setContext } = renderApp(<Startup />, { ctx: bandContext() });
    await settle();
    expect(checkForUpdates).toHaveBeenCalledTimes(1);

    setContext(bandContext({ isOnline: false }));
    await settle();
    setContext(bandContext({ isOnline: true }));
    await settle(1_000);
    setContext(bandContext({ isOnline: false }));
    await settle();
    setContext(bandContext({ isOnline: true }));
    await settle(ONLINE_CHECK_DEBOUNCE_MS - 1);
    expect(checkForUpdates).toHaveBeenCalledTimes(1);
    await settle(1);
    expect(checkForUpdates).toHaveBeenCalledTimes(2);
  });
});

describe("useOfflineUpdateCheckOnOpen", () => {
  it("checks that setlist when the detail opens online with a session", async () => {
    renderApp(<Detail id="s1" />, { ctx: bandContext() });
    await settle();
    expect(checkForUpdates).toHaveBeenCalledWith(["s1"]);
  });

  it("does nothing offline or without a session", async () => {
    renderApp(<Detail id="s1" />, { ctx: bandContext({ isOnline: false }) });
    renderApp(<Detail id="s1" />, { ctx: bandContext({ authMode: "offline-cached" }) });
    await settle();
    expect(checkForUpdates).not.toHaveBeenCalled();
  });
});
