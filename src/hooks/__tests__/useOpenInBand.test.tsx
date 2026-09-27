// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, within } from "@testing-library/react";
import type { Band } from "../../services/bandsService";
import { bandContext, renderApp, testBand } from "../../test/renderApp";
import { useOpenInBand } from "../useOpenInBand";

/** Every select and navigate, in call order. */
const calls = vi.hoisted(() => [] as string[]);

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => {
      const navigate = actual.useNavigate();
      return (to: string) => {
        calls.push(`navigate ${to}`);
        return navigate(to);
      };
    },
  };
});

const A = testBand(1, "Los Rockers");
const B = testBand(2, "Jazz Trio");

let open: (bandId: number, path: string) => void = () => {};
const Probe = () => {
  open = useOpenInBand();
  return null;
};

function setup() {
  const setSelectedBand = vi.fn((band: Band | null) => calls.push(`select ${band?.id}`));
  renderApp(<Probe />, { ctx: bandContext({ bands: [A, B], selectedBand: A, setSelectedBand }) });
  return { setSelectedBand };
}

const location = () => screen.getByTestId("location").textContent;
// Inside the ToastProvider's region, rendered only while a toast shows
// (LocationProbe's <output> has role "status" too).
const toasts = () => {
  const region = screen.queryByRole("region", { name: "Notifications" });
  return region ? within(region).queryAllByRole("status").map((toast) => toast.textContent) : [];
};

beforeEach(() => {
  calls.length = 0;
});

describe("useOpenInBand (AC3)", () => {
  it("same band: navigates, no switch, no toast", () => {
    const { setSelectedBand } = setup();
    act(() => open(A.id, "/shows/s1"));
    expect(setSelectedBand).not.toHaveBeenCalled();
    expect(location()).toBe("/shows/s1");
    expect(toasts()).toEqual([]);
  });

  it("other band: selects it, then navigates, then one info toast names it", () => {
    const { setSelectedBand } = setup();
    act(() => open(B.id, "/setlists/l1"));
    expect(setSelectedBand).toHaveBeenCalledTimes(1);
    expect(setSelectedBand).toHaveBeenCalledWith(B);
    expect(calls).toEqual(["select 2", "navigate /setlists/l1"]);
    expect(location()).toBe("/setlists/l1");
    expect(toasts()).toHaveLength(1);
    expect(toasts()[0]).toContain("Switched to Jazz Trio");
  });

  it("unknown band: navigates anyway, no switch, no toast, no throw", () => {
    const { setSelectedBand } = setup();
    expect(() => act(() => open(99, "/rehearsals/r1"))).not.toThrow();
    expect(setSelectedBand).not.toHaveBeenCalled();
    expect(location()).toBe("/rehearsals/r1");
    expect(toasts()).toEqual([]);
  });
});
