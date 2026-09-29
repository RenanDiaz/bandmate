// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthButton } from "../AuthButton";
import { performUserSignOut } from "../context/offlineAuthController";
import { bandContext, renderApp } from "../test/renderApp";
import { wipeAll } from "../services/offlineSetlistService";
import { unsubscribeThisDevice, updateThisDeviceLocale } from "../lib/pushSupport";
import { PUSH_FLAG_STORAGE_KEY } from "../lib/featureFlags";
import {
  closeNotificationSettings,
  useNotificationSettingsOpen,
} from "../components/notifications/notificationSettingsStore";

vi.mock("../services/offlineSetlistService", () => ({ wipeAll: vi.fn(async () => {}) }));
vi.mock("../lib/pushSupport", () => ({
  unsubscribeThisDevice: vi.fn(async () => {}),
  updateThisDeviceLocale: vi.fn(async () => {}),
}));
vi.mock("../lib/authSession", () => ({ signOutEverywhereOrLocally: vi.fn(async () => {}) }));
vi.mock("../context/offlineAuthController", () => ({ performUserSignOut: vi.fn(async () => {}) }));
vi.mock("../lib/pwaUpdates", () => ({
  getPwaUpdater: () => ({ checkForUpdate: vi.fn(async () => "up-to-date"), applyUpdate: vi.fn() }),
}));

const signedIn = bandContext({ user: { id: "user-a", email: "ana@example.com" } });

beforeEach(() => {
  vi.mocked(performUserSignOut).mockClear();
  vi.mocked(wipeAll).mockClear();
  vi.mocked(unsubscribeThisDevice).mockClear();
  vi.mocked(updateThisDeviceLocale).mockClear();
  localStorage.removeItem(PUSH_FLAG_STORAGE_KEY);
  closeNotificationSettings();
});

const SettingsOpenProbe = () => <output data-testid="settings-open">{String(useNotificationSettingsOpen())}</output>;

describe("AuthButton notifications (band push notifications §2.1)", () => {
  it("has no Notifications row with the flag off", () => {
    renderApp(<AuthButton variant="inline" />, { ctx: signedIn });
    expect(screen.queryByRole("button", { name: "Notifications" })).toBeNull();
  });

  it("with the flag on, lists Notifications before Check for updates and opens the settings", async () => {
    localStorage.setItem(PUSH_FLAG_STORAGE_KEY, "1");
    const onAction = vi.fn();
    renderApp(
      <>
        <AuthButton variant="inline" onAction={onAction} />
        <SettingsOpenProbe />
      </>,
      { ctx: signedIn }
    );

    const panel = screen.getByTestId("account-panel");
    const labels = Array.from(panel.querySelectorAll("button, a"), (el) => el.textContent?.trim());
    expect(labels).toEqual(["EN", "ES", "Offline setlists", "About", "Notifications", "Check for updates", "Sign out"]);

    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByTestId("settings-open").textContent).toBe("true");
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("hides Notifications offline and in offline-cached", () => {
    localStorage.setItem(PUSH_FLAG_STORAGE_KEY, "1");
    const { setContext } = renderApp(<AuthButton variant="inline" />, {
      ctx: bandContext({ user: { id: "user-a", email: "ana@example.com" }, isOnline: false }),
    });
    expect(screen.queryByRole("button", { name: "Notifications" })).toBeNull();

    setContext(bandContext({ user: { id: "user-a" }, authMode: "offline-cached" }));
    expect(screen.queryByRole("button", { name: "Notifications" })).toBeNull();
  });

  it("sign-out clears the offline copies and this device's push subscription", async () => {
    renderApp(<AuthButton variant="inline" />, { ctx: signedIn });
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(performUserSignOut).toHaveBeenCalledTimes(1));

    const clear = vi.mocked(performUserSignOut).mock.calls[0][0];
    await clear();
    expect(wipeAll).toHaveBeenCalledTimes(1);
    expect(unsubscribeThisDevice).toHaveBeenCalledTimes(1);
  });

  it("a failed push unsubscribe doesn't fail the wipe step; a failed wipe still rejects", async () => {
    renderApp(<AuthButton variant="inline" />, { ctx: signedIn });
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(performUserSignOut).toHaveBeenCalledTimes(1));
    const clear = vi.mocked(performUserSignOut).mock.calls[0][0];

    vi.mocked(unsubscribeThisDevice).mockRejectedValueOnce(new Error("offline"));
    await expect(clear()).resolves.toBeUndefined();

    vi.mocked(wipeAll).mockRejectedValueOnce(new Error("idb"));
    await expect(clear()).rejects.toThrow("idb");
  });

  it("changing the language updates the push language only with the flag on", async () => {
    renderApp(<AuthButton variant="inline" />, { ctx: signedIn });
    await userEvent.click(screen.getByRole("button", { name: "ES" }));
    expect(updateThisDeviceLocale).not.toHaveBeenCalled();

    localStorage.setItem(PUSH_FLAG_STORAGE_KEY, "1");
    await userEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(updateThisDeviceLocale).toHaveBeenCalledWith("en");
  });
});

describe("AuthButton inline (mobile drawer)", () => {
  it("renders the account rows flat, with no menu to open", () => {
    renderApp(<AuthButton variant="inline" />, { ctx: signedIn });

    expect(screen.getByTestId("account-panel")).toBeTruthy();
    expect(screen.getByText("Signed in as")).toBeTruthy();
    expect(screen.getByText("ana@example.com")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check for updates" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "EN" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "User menu" })).toBeNull();
  });

  it("signs out through performUserSignOut and reports the action", async () => {
    const onAction = vi.fn();
    renderApp(<AuthButton variant="inline" onAction={onAction} />, { ctx: signedIn });

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
    expect(performUserSignOut).toHaveBeenCalledTimes(1);
  });

  it("lists About between Language and Check for updates, and closes the drawer on it", async () => {
    const onAction = vi.fn();
    renderApp(<AuthButton variant="inline" onAction={onAction} />, { ctx: signedIn });

    const about = screen.getByRole("link", { name: "About" });
    expect(about.getAttribute("href")).toBe("/about");
    const panel = screen.getByTestId("account-panel");
    const labels = Array.from(panel.querySelectorAll("button, a"), (el) => el.textContent?.trim());
    expect(labels).toEqual(["EN", "ES", "Offline setlists", "About", "Check for updates", "Sign out"]);

    await userEvent.click(about);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("location").textContent).toBe("/about");
  });

  it("shows the offline hint instead of an email in offline-cached", () => {
    renderApp(<AuthButton variant="inline" />, {
      ctx: bandContext({ user: { id: "user-a" }, authMode: "offline-cached" }),
    });

    expect(screen.getByText("Offline — using the account saved on this device")).toBeTruthy();
    expect(screen.queryByText("Signed in as")).toBeNull();
  });

  it("renders a full-width Sign in when signed out", () => {
    renderApp(<AuthButton variant="inline" />, { ctx: bandContext({ user: null, authMode: "signed-out" }) });

    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.queryByTestId("account-panel")).toBeNull();
  });
});

describe("AuthButton dropdown (desktop navbar)", () => {
  it("opens from the trigger and closes on Escape and on a click outside", async () => {
    renderApp(
      <>
        <p>outside</p>
        <AuthButton />
      </>,
      { ctx: signedIn }
    );
    const trigger = screen.getByRole("button", { name: "User menu" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await userEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Signed in as")).toBeTruthy();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();

    await userEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.mouseDown(screen.getByText("outside"));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("the About item navigates to /about and closes the menu (AC3)", async () => {
    renderApp(<AuthButton />, { ctx: signedIn });
    await userEvent.click(screen.getByRole("button", { name: "User menu" }));

    const menu = screen.getByRole("menu");
    const labels = Array.from(menu.querySelectorAll("button, a"), (el) => el.textContent?.trim());
    expect(labels).toEqual(["EN", "ES", "Offline setlists", "About", "Check for updates", "Sign out"]);

    const about = within(menu).getByRole("link", { name: "About" });
    expect(about.getAttribute("href")).toBe("/about");
    await userEvent.click(about);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByTestId("location").textContent).toBe("/about");
  });

  it("offers About in offline-cached too", async () => {
    renderApp(<AuthButton />, {
      ctx: bandContext({ user: { id: "user-a", offlineCached: true }, authMode: "offline-cached" }),
    });
    await userEvent.click(screen.getByRole("button", { name: "User menu" }));

    expect(within(screen.getByRole("menu")).getByRole("link", { name: "About" })).toBeTruthy();
  });

  it("compact shows no email in the trigger; the default trigger does", () => {
    const { unmount } = renderApp(<AuthButton compact />, { ctx: signedIn });
    expect(screen.getByRole("button", { name: "User menu" }).textContent).not.toContain("ana@example.com");
    unmount();

    renderApp(<AuthButton />, { ctx: signedIn });
    expect(screen.getByRole("button", { name: "User menu" }).textContent).toContain("ana@example.com");
  });

  it("stays open on a click inside the menu", async () => {
    renderApp(<AuthButton />, { ctx: signedIn });
    await userEvent.click(screen.getByRole("button", { name: "User menu" }));

    fireEvent.mouseDown(screen.getByText("Signed in as"));
    expect(screen.getByRole("menu")).toBeTruthy();
  });
});
