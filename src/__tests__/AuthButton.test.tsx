// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthButton } from "../AuthButton";
import { performUserSignOut } from "../context/offlineAuthController";
import { bandContext, renderApp } from "../test/renderApp";

vi.mock("../services/offlineSetlistService", () => ({ wipeAll: vi.fn(async () => {}) }));
vi.mock("../lib/authSession", () => ({ signOutEverywhereOrLocally: vi.fn(async () => {}) }));
vi.mock("../context/offlineAuthController", () => ({ performUserSignOut: vi.fn(async () => {}) }));
vi.mock("../lib/pwaUpdates", () => ({
  getPwaUpdater: () => ({ checkForUpdate: vi.fn(async () => "up-to-date"), applyUpdate: vi.fn() }),
}));

const signedIn = bandContext({ user: { id: "user-a", email: "ana@example.com" } });

beforeEach(() => {
  vi.mocked(performUserSignOut).mockClear();
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

  it("stays open on a click inside the menu", async () => {
    renderApp(<AuthButton />, { ctx: signedIn });
    await userEvent.click(screen.getByRole("button", { name: "User menu" }));

    fireEvent.mouseDown(screen.getByText("Signed in as"));
    expect(screen.getByRole("menu")).toBeTruthy();
  });
});
