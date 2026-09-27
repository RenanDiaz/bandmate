// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppNavbar } from "../AppNavbar";
import { NAV_LINKS, isNavLinkActive } from "../navLinks";
import { bandContext, renderApp, testBand } from "../../test/renderApp";

vi.mock("../../services/bandMembersService", () => ({
  getMyInvitations: vi.fn(async () => []),
  acceptInvitation: vi.fn(),
  declineInvitation: vi.fn(),
}));
vi.mock("../../services/offlineSetlistService", () => ({ wipeAll: vi.fn(async () => {}) }));
vi.mock("../../lib/authSession", () => ({ signOutEverywhereOrLocally: vi.fn(async () => {}) }));
vi.mock("../../lib/pwaUpdates", () => ({
  getPwaUpdater: () => ({ checkForUpdate: vi.fn(async () => "up-to-date"), applyUpdate: vi.fn() }),
}));

const BAND = testBand(7, "Los Guardianes del Ritmo Eterno");
const signedIn = bandContext({
  user: { id: "user-a", email: "ana@example.com" },
  selectedBand: BAND,
  bands: [BAND],
});

const activeLinks = (pathname: string) =>
  NAV_LINKS.filter((link) => isNavLinkActive(link, pathname)).map((link) => link.to);

describe("isNavLinkActive (AC1)", () => {
  it("marks one section per path", () => {
    expect(activeLinks("/setlists/abc")).toEqual(["/setlists"]);
    expect(activeLinks("/")).toEqual(["/"]);
    expect(activeLinks("/songs/print")).toEqual(["/songs"]);
    expect(activeLinks("/about")).toEqual([]);
  });
});

const navLists = () => Array.from(document.querySelectorAll<HTMLElement>("ul.navbar-nav"));
const linkTargets = (list: HTMLElement) =>
  within(list)
    .getAllByRole("link", { hidden: true })
    .map((a) => [a.getAttribute("href"), a.textContent?.trim()]);

describe("AppNavbar (AC2)", () => {
  it("desktop lists the five sections; the offcanvas adds Home first; neither has About", async () => {
    renderApp(<AppNavbar mode="dark" onToggleMode={vi.fn()} />, { ctx: signedIn, path: "/setlists/abc" });

    const [desktop] = navLists();
    expect(navLists()).toHaveLength(1);
    const sections = [
      ["/songs", "Songs"],
      ["/setlists", "Setlists"],
      ["/shows", "Shows"],
      ["/rehearsals", "Rehearsals"],
      ["/requests", "Requests"],
    ];
    expect(linkTargets(desktop)).toEqual(sections);

    // Hidden in jsdom: it has no viewport, so the "below lg" media query never applies.
    await userEvent.click(screen.getByLabelText("Toggle navigation"));
    const lists = navLists();
    expect(lists).toHaveLength(2);
    const offcanvas = lists.find((list) => list !== desktop)!;
    expect(linkTargets(offcanvas)).toEqual([["/", "Home"], ...sections]);

    // The only About left is the account rows' (user menu), not a nav link.
    const abouts = screen.getAllByRole("link", { name: "About", hidden: true });
    expect(abouts).toHaveLength(1);
    expect(screen.getByTestId("account-panel").contains(abouts[0])).toBe(true);
  });

  it("the desktop user button is compact: no email in the trigger", () => {
    renderApp(<AppNavbar mode="dark" onToggleMode={vi.fn()} />, { ctx: signedIn });

    const trigger = screen.getByRole("button", { name: "User menu" });
    expect(trigger.textContent).not.toContain("ana@example.com");
    expect(screen.getByRole("button", { name: "Switch Band" }).textContent).toContain(BAND.name);
  });
});
