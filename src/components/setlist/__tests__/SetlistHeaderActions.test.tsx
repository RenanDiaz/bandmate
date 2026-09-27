// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { createTestI18n } from "../../../test/i18n";
import { SetlistHeaderActions, type SetlistHeaderActionsProps } from "../SetlistHeaderActions";

const i18n = createTestI18n();

function handlers() {
  return {
    onPerform: vi.fn(),
    onEdit: vi.fn(),
    onReorder: vi.fn(),
    onRename: vi.fn(),
    onPrint: vi.fn(),
    onExport: vi.fn(),
    onYouTube: vi.fn(),
    onPropose: vi.fn(),
  };
}

function renderActions(overrides: Partial<SetlistHeaderActionsProps> = {}) {
  const fns = handlers();
  const props: SetlistHeaderActionsProps = {
    canEdit: true,
    itemCount: 5,
    songCount: 4,
    reorderMode: false,
    ...fns,
    ...overrides,
  };
  render(
    <I18nextProvider i18n={i18n}>
      <SetlistHeaderActions {...props} />
    </I18nextProvider>,
  );
  return fns;
}

const perform = () => screen.getByRole("button", { name: "Start Performance" });
const edit = () => screen.queryByRole("button", { name: "Edit Setlist" });
const more = () => screen.getByRole("button", { name: "More actions" });
const openMenu = async () => {
  await userEvent.click(more());
  return screen.getByRole("menu");
};
// reactstrap gives a disabled item no menuitem role and a divider no separator role: read the DOM.
const items = (menu: HTMLElement) => Array.from(menu.querySelectorAll<HTMLButtonElement>("button.dropdown-item"));
const itemNames = (menu: HTMLElement) => items(menu).map((el) => el.textContent?.trim());
const item = (menu: HTMLElement, name: string) => {
  const found = items(menu).find((el) => el.textContent?.trim() === name);
  if (!found) throw new Error(`no menu item "${name}"`);
  return found;
};
const dividers = (menu: HTMLElement) => menu.querySelectorAll(".dropdown-divider").length;

afterEach(cleanup);

describe("SetlistHeaderActions (spec §2.2–2.3)", () => {
  it("an editor sees Perform, Edit and More actions, in that order", () => {
    renderActions();
    const buttons = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent?.trim());
    expect(buttons).toEqual(["Start Performance", "Edit Setlist", "More actions"]);
  });

  it("a guest sees Perform and More actions only, with the read-only items", async () => {
    renderActions({ canEdit: false });
    expect(edit()).toBeNull();
    const menu = await openMenu();
    expect(itemNames(menu)).toEqual(["Print", "Export", "Export to YouTube Music", "Propose"]);
    expect(dividers(menu)).toBe(1);
  });

  it("the editor menu lists Reorder and Rename first, then a divider", async () => {
    renderActions();
    const menu = await openMenu();
    expect(itemNames(menu)).toEqual([
      "Reorder",
      "Rename Setlist",
      "Print",
      "Export",
      "Export to YouTube Music",
      "Propose",
    ]);
    expect(dividers(menu)).toBe(2);
  });

  it("disables by state: Reorder under 2 songs, Print with no items, Export/YouTube with no songs", async () => {
    renderActions({ itemCount: 1, songCount: 1 });
    let menu = await openMenu();
    expect(item(menu, "Reorder")).toHaveProperty("disabled", true);
    expect(item(menu, "Print")).toHaveProperty("disabled", false);
    expect(item(menu, "Export")).toHaveProperty("disabled", false);
    cleanup();

    renderActions({ itemCount: 1, songCount: 0 });
    expect(perform()).toHaveProperty("disabled", false);
    menu = await openMenu();
    expect(item(menu, "Export")).toHaveProperty("disabled", true);
    expect(item(menu, "Export to YouTube Music")).toHaveProperty("disabled", true);
    cleanup();

    renderActions({ itemCount: 0, songCount: 0 });
    expect(perform()).toHaveProperty("disabled", true);
    menu = await openMenu();
    expect(item(menu, "Print")).toHaveProperty("disabled", true);
  });

  it("calls the handler of each control and closes the menu after an item", async () => {
    const fns = renderActions();
    await userEvent.click(perform());
    expect(fns.onPerform).toHaveBeenCalledTimes(1);
    await userEvent.click(edit()!);
    expect(fns.onEdit).toHaveBeenCalledTimes(1);

    const pairs: Array<[string, keyof ReturnType<typeof handlers>]> = [
      ["Reorder", "onReorder"],
      ["Rename Setlist", "onRename"],
      ["Print", "onPrint"],
      ["Export", "onExport"],
      ["Export to YouTube Music", "onYouTube"],
      ["Propose", "onPropose"],
    ];
    for (const [name, fn] of pairs) {
      const menu = await openMenu();
      await userEvent.click(within(menu).getByRole("menuitem", { name }));
      expect(fns[fn]).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("menu")).toBeNull();
    }
  });

  it("reorder mode disables the three header controls", () => {
    renderActions({ reorderMode: true });
    expect(perform()).toHaveProperty("disabled", true);
    expect(edit()).toHaveProperty("disabled", true);
    expect(more()).toHaveProperty("disabled", true);
  });
});
