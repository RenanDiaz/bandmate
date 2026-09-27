import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

/**
 * public/push-sw.js runs inside the Workbox worker (importScripts), so it is
 * evaluated here against a fake `self`.
 */
const SOURCE = readFileSync(fileURLToPath(new URL("../../../public/push-sw.js", import.meta.url)), "utf8");
const ORIGIN = "https://www.bandmate.space";

type Listener = (event: Record<string, unknown>) => void;

function loadWorker(windows: { url: string; navigate?: (url: string) => Promise<unknown> }[] = []) {
  const listeners = new Map<string, Listener>();
  const showNotification = vi.fn(async () => {});
  const openWindow = vi.fn(async () => null);
  const clientObjects = windows.map((w) => {
    const client: Record<string, unknown> = { url: w.url };
    client.focus = vi.fn(async () => client);
    if (w.navigate) client.navigate = vi.fn(w.navigate);
    return client;
  });
  const self = {
    location: new URL(`${ORIGIN}/sw.js`),
    registration: { showNotification },
    clients: { matchAll: vi.fn(async () => clientObjects), openWindow },
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
  };
  new Function("self", SOURCE)(self);

  async function dispatch(type: string, event: Record<string, unknown>) {
    let pending: Promise<unknown> = Promise.resolve();
    listeners.get(type)!({ ...event, waitUntil: (p: Promise<unknown>) => (pending = p) });
    await pending;
  }
  return { dispatch, showNotification, openWindow, clientObjects };
}

const pushEvent = (payload: unknown) => ({
  data: {
    json: () => (typeof payload === "string" ? JSON.parse(payload) : payload),
  },
});

const clickEvent = (url: unknown) => ({ notification: { data: { url }, close: vi.fn() } });

describe("push-sw.js", () => {
  it("shows the payload's title, body, tag and url", async () => {
    const { dispatch, showNotification } = loadWorker();
    await dispatch(
      "push",
      pushEvent({ title: "Los Tigres · New show", body: "Ana added…", url: "/shows/1?band=7", tag: "show.created:1" })
    );
    expect(showNotification).toHaveBeenCalledWith("Los Tigres · New show", {
      body: "Ana added…",
      tag: "show.created:1",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: "/shows/1?band=7" },
    });
  });

  it("still shows a notification for an unreadable payload (required for every push)", async () => {
    const { dispatch, showNotification } = loadWorker();
    await dispatch("push", pushEvent("{not json"));
    expect(showNotification).toHaveBeenCalledWith("Bandmate", expect.objectContaining({ body: "", data: { url: "/" } }));
  });

  it("a tap focuses an open window and navigates it", async () => {
    const navigate = vi.fn(async () => null);
    const { dispatch, openWindow, clientObjects } = loadWorker([{ url: `${ORIGIN}/songs`, navigate }]);
    await dispatch("notificationclick", clickEvent("/shows/1?band=7"));
    expect(clientObjects[0].focus).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(`${ORIGIN}/shows/1?band=7`);
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("opens a window when none is open or navigate fails", async () => {
    const none = loadWorker();
    await none.dispatch("notificationclick", clickEvent("/rehearsals/r?band=2"));
    expect(none.openWindow).toHaveBeenCalledWith(`${ORIGIN}/rehearsals/r?band=2`);

    const failing = loadWorker([{ url: `${ORIGIN}/`, navigate: async () => Promise.reject(new Error("uncontrolled")) }]);
    await failing.dispatch("notificationclick", clickEvent("/setlists/s?band=2"));
    expect(failing.openWindow).toHaveBeenCalledWith(`${ORIGIN}/setlists/s?band=2`);
  });

  it("never opens another origin", async () => {
    const { dispatch, openWindow } = loadWorker();
    await dispatch("notificationclick", clickEvent("https://evil.example/phish"));
    expect(openWindow).toHaveBeenCalledWith(`${ORIGIN}/`);

    await dispatch("notificationclick", clickEvent("//evil.example/x"));
    expect(openWindow).toHaveBeenLastCalledWith(`${ORIGIN}/`);
  });
});
