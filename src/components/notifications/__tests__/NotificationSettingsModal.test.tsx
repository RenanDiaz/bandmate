// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { bandContext, renderApp, testBand } from "../../../test/renderApp";
import { NotificationSettingsModal } from "../NotificationSettingsModal";
import { PushSupportError, getPushStatus, subscribeThisDevice, syncThisDevice, unsubscribeThisDevice } from "../../../lib/pushSupport";
import { getMutedBandIds, setBandMuted } from "../../../services/pushSubscriptionService";

vi.mock("../../../lib/pushSupport", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/pushSupport")>();
  return {
    PushSupportError: actual.PushSupportError,
    getPushStatus: vi.fn(),
    subscribeThisDevice: vi.fn(),
    syncThisDevice: vi.fn(async () => {}),
    unsubscribeThisDevice: vi.fn(async () => {}),
  };
});
vi.mock("../../../services/pushSubscriptionService", () => ({
  getMutedBandIds: vi.fn(),
  setBandMuted: vi.fn(async () => {}),
}));

const A = testBand(1, "Los Tigres");
const B = testBand(2, "Jazz Trio");
const ctx = bandContext({ bands: [A, B], selectedBand: A });

beforeEach(() => {
  vi.mocked(getPushStatus).mockReset().mockResolvedValue("off");
  vi.mocked(subscribeThisDevice).mockReset().mockResolvedValue();
  vi.mocked(syncThisDevice).mockClear();
  vi.mocked(unsubscribeThisDevice).mockClear();
  vi.mocked(getMutedBandIds).mockReset().mockResolvedValue([2]);
  vi.mocked(setBandMuted).mockClear();
});

describe("NotificationSettingsModal", () => {
  it("turns this device on and shows the band switches (muted ones off)", async () => {
    renderApp(<NotificationSettingsModal isOpen onClose={() => {}} />, { ctx });

    await userEvent.click(await screen.findByRole("button", { name: /Turn on/ }));
    expect(subscribeThisDevice).toHaveBeenCalledWith("en");
    expect(await screen.findByText("On for this device.")).toBeTruthy();

    const tigres = screen.getByLabelText("Notify me about Los Tigres") as HTMLInputElement;
    const jazz = screen.getByLabelText("Notify me about Jazz Trio") as HTMLInputElement;
    expect(tigres.checked).toBe(true);
    expect(jazz.checked).toBe(false);
  });

  it("re-syncs an existing subscription on open, and turns it off", async () => {
    vi.mocked(getPushStatus).mockResolvedValue("on");
    renderApp(<NotificationSettingsModal isOpen onClose={() => {}} />, { ctx });

    await userEvent.click(await screen.findByRole("button", { name: /Turn off/ }));
    expect(syncThisDevice).toHaveBeenCalledWith("en");
    expect(unsubscribeThisDevice).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: /Turn on/ })).toBeTruthy();
  });

  it("a refused prompt shows the blocked state", async () => {
    vi.mocked(subscribeThisDevice).mockRejectedValue(new PushSupportError("denied"));
    renderApp(<NotificationSettingsModal isOpen onClose={() => {}} />, { ctx });
    await userEvent.click(await screen.findByRole("button", { name: /Turn on/ }));
    expect(await screen.findByText(/Notifications are blocked/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Turn on/ })).toBeNull();
  });

  it("a failed subscribe keeps Turn on with an inline error", async () => {
    vi.mocked(subscribeThisDevice).mockRejectedValue(new PushSupportError("failed"));
    renderApp(<NotificationSettingsModal isOpen onClose={() => {}} />, { ctx });
    await userEvent.click(await screen.findByRole("button", { name: /Turn on/ }));
    expect(await screen.findByText("Couldn't turn on notifications. Try again.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Turn on/ })).toBeTruthy();
  });

  it("toggling a band mutes / unmutes it", async () => {
    renderApp(<NotificationSettingsModal isOpen onClose={() => {}} />, { ctx });
    const tigres = (await screen.findByLabelText("Notify me about Los Tigres")) as HTMLInputElement;
    await userEvent.click(tigres);
    expect(setBandMuted).toHaveBeenCalledWith(1, true);
    await waitFor(() => expect(tigres.checked).toBe(false));

    await userEvent.click(screen.getByLabelText("Notify me about Jazz Trio"));
    expect(setBandMuted).toHaveBeenCalledWith(2, false);
  });

  it("a failed mute load offers Retry", async () => {
    vi.mocked(getMutedBandIds).mockRejectedValueOnce(new Error("offline"));
    renderApp(<NotificationSettingsModal isOpen onClose={() => {}} />, { ctx });
    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByLabelText("Notify me about Los Tigres")).toBeTruthy();
  });
});
