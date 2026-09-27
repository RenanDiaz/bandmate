// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { bandContext, renderApp } from "../../../test/renderApp";
import { SetlistRowMenu } from "../SetlistRowMenu";

function renderMenu(props: { index?: number; count?: number; onRemove?: () => void } = {}) {
  const onMove = vi.fn();
  renderApp(
    <SetlistRowMenu index={props.index ?? 1} count={props.count ?? 3} itemLabel="Karma" onMove={onMove} onRemove={props.onRemove} />,
    { ctx: bandContext() }
  );
  return onMove;
}

const open = () => fireEvent.click(screen.getByRole("button", { name: "More actions for Karma" }));
const item = (name: string) => screen.getByRole("menuitem", { name }) as HTMLButtonElement;

describe("SetlistRowMenu", () => {
  it("is closed until the trigger is pressed", () => {
    renderMenu();
    expect(screen.queryByRole("menu")).toBeNull();
    open();
    expect(screen.getByRole("menu", { name: "More actions for Karma" })).toBeTruthy();
  });

  it("calls onMove with each target and closes", () => {
    const onMove = renderMenu();
    for (const [name, target] of [
      ["Move up", "up"],
      ["Move down", "down"],
      ["Move to top", "top"],
      ["Move to bottom", "bottom"],
    ] as const) {
      open();
      fireEvent.click(item(name));
      expect(onMove).toHaveBeenLastCalledWith(target);
      expect(screen.queryByRole("menu")).toBeNull();
    }
  });

  it("disables moves past the ends", () => {
    renderMenu({ index: 0, count: 3 });
    open();
    expect(item("Move up").disabled).toBe(true);
    expect(item("Move to top").disabled).toBe(true);
    expect(item("Move down").disabled).toBe(false);
  });

  it("shows Remove only when given", () => {
    renderMenu();
    open();
    expect(screen.queryByRole("menuitem", { name: "Remove" })).toBeNull();
  });

  it("Remove calls onRemove", () => {
    const onRemove = vi.fn();
    renderMenu({ onRemove });
    open();
    fireEvent.click(item("Remove"));
    expect(onRemove).toHaveBeenCalled();
  });

  it("Escape closes and returns focus to the trigger; the key does not reach window", () => {
    const onWindowKey = vi.fn();
    window.addEventListener("keydown", onWindowKey);
    renderMenu();
    open();
    fireEvent.keyDown(item("Move up"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "More actions for Karma" }));
    expect(onWindowKey).not.toHaveBeenCalled();
    window.removeEventListener("keydown", onWindowKey);
  });

  it("closes on a press outside", () => {
    renderMenu();
    open();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("does not bubble its clicks to the row", () => {
    const onRow = vi.fn();
    renderApp(
      <div onClick={onRow}>
        <SetlistRowMenu index={1} count={3} itemLabel="Karma" onMove={vi.fn()} />
      </div>,
      { ctx: bandContext() }
    );
    open();
    fireEvent.click(item("Move up"));
    expect(onRow).not.toHaveBeenCalled();
  });
});
