// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { Band } from "../../services/bandsService";
import { bandContext, renderApp, testBand } from "../../test/renderApp";
import { useBandFromQuery } from "../useBandFromQuery";

const A = testBand(1, "Los Rockers");
const B = testBand(2, "Jazz Trio");

const Probe = () => <output data-testid="pending">{String(useBandFromQuery())}</output>;

const location = () => screen.getByTestId("location");
const toasts = () => {
  const region = screen.queryByRole("region", { name: "Notifications" });
  return region ? within(region).queryAllByRole("status").map((toast) => toast.textContent) : [];
};

describe("useBandFromQuery (band push notifications §1 decision 6)", () => {
  it("selects the band, drops the param and keeps the path and other params", async () => {
    const setSelectedBand = vi.fn((band: Band | null) => band);
    renderApp(<Probe />, {
      ctx: bandContext({ bands: [A, B], selectedBand: A, setSelectedBand }),
      path: "/shows/s1?band=2&tab=notes",
    });

    await waitFor(() => expect(location().getAttribute("data-search")).toBe("?tab=notes"));
    expect(location().textContent).toBe("/shows/s1");
    expect(setSelectedBand).toHaveBeenCalledTimes(1);
    expect(setSelectedBand).toHaveBeenCalledWith(B);
    expect(toasts().join()).toContain("Jazz Trio");
  });

  it("same band: no switch, no toast, param dropped", async () => {
    const setSelectedBand = vi.fn();
    renderApp(<Probe />, {
      ctx: bandContext({ bands: [A, B], selectedBand: B, setSelectedBand }),
      path: "/setlists/x?band=2",
    });
    await waitFor(() => expect(location().getAttribute("data-search")).toBe(""));
    expect(location().textContent).toBe("/setlists/x");
    expect(setSelectedBand).not.toHaveBeenCalled();
    expect(toasts()).toEqual([]);
  });

  it("unknown or malformed band: only the param goes", async () => {
    const setSelectedBand = vi.fn();
    renderApp(<Probe />, {
      ctx: bandContext({ bands: [A], selectedBand: A, setSelectedBand }),
      path: "/rehearsals/r1?band=abc",
    });
    await waitFor(() => expect(location().getAttribute("data-search")).toBe(""));
    expect(setSelectedBand).not.toHaveBeenCalled();
  });

  it("a band with none selected yet (BandSelector gate) is selected too", async () => {
    const setSelectedBand = vi.fn();
    renderApp(<Probe />, {
      ctx: bandContext({ bands: [A, B], selectedBand: null, setSelectedBand }),
      path: "/shows/s1?band=1",
    });
    await waitFor(() => expect(setSelectedBand).toHaveBeenCalledWith(A));
  });

  it("waits while bands resolve, reporting pending only once they did", async () => {
    const setSelectedBand = vi.fn();
    const { setContext } = renderApp(<Probe />, {
      ctx: bandContext({ bands: [], selectedBand: null, isResolvingBand: true, setSelectedBand }),
      path: "/shows/s1?band=2",
    });
    expect(screen.getByTestId("pending").textContent).toBe("false");
    expect(location().getAttribute("data-search")).toBe("?band=2");

    setContext(bandContext({ bands: [A, B], selectedBand: A, setSelectedBand }));
    await waitFor(() => expect(setSelectedBand).toHaveBeenCalledWith(B));
    await waitFor(() => expect(screen.getByTestId("pending").textContent).toBe("false"));
  });

  it("signed out: leaves the URL alone", () => {
    renderApp(<Probe />, { ctx: bandContext({ user: null, authMode: "signed-out" }), path: "/shows/s1?band=2" });
    expect(screen.getByTestId("pending").textContent).toBe("false");
    expect(location().getAttribute("data-search")).toBe("?band=2");
  });

  it("without the param it is never pending", () => {
    renderApp(<Probe />, { ctx: bandContext({ bands: [A] }), path: "/shows/s1" });
    expect(screen.getByTestId("pending").textContent).toBe("false");
  });
});
