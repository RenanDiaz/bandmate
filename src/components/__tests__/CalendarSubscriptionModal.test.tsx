// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { bandContext, renderApp } from "../../test/renderApp";
import type { CalendarSubscription } from "../../services/calendarSubscriptionService";

const service = vi.hoisted(() => ({
  getCalendarSubscription: vi.fn(),
  createCalendarSubscription: vi.fn(),
  updateCalendarSubscriptionOptions: vi.fn(),
  regenerateSubscriptionToken: vi.fn(),
  deleteCalendarSubscription: vi.fn(),
  getDeviceTimeZone: vi.fn(() => "America/Panama"),
}));

vi.mock("../../services/calendarSubscriptionService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/calendarSubscriptionService")>()),
  ...service,
}));

import { CalendarSubscriptionModal } from "../CalendarSubscriptionModal";

const sub = (overrides: Partial<CalendarSubscription> = {}): CalendarSubscription => ({
  id: "sub-1",
  band_id: 7,
  user_id: "user-a",
  token: "11111111-1111-1111-1111-111111111111",
  is_active: true,
  include_shows: true,
  include_rehearsals: true,
  timezone: "America/Panama",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

const renderModal = () =>
  renderApp(
    <CalendarSubscriptionModal isOpen onClose={vi.fn()} bandId={7} bandName="Band 7" />,
    { ctx: bandContext() }
  );

describe("CalendarSubscriptionModal", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://abc.supabase.co");
    service.getDeviceTimeZone.mockReturnValue("America/Panama");
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("offers one-tap subscribe links for an existing subscription", async () => {
    service.getCalendarSubscription.mockResolvedValue(sub());
    renderModal();

    const apple = await screen.findByRole("link", { name: /Apple Calendar/ });
    expect(apple.getAttribute("href")).toMatch(/^webcal:\/\/.*token=11111111/);
    expect(
      screen.getByRole("link", { name: /Google Calendar/ }).getAttribute("href")
    ).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/r\?cid=webcal/);
    expect(screen.getByText("Times in America/Panama")).toBeTruthy();
  });

  it("saves the include toggles and never lets both be off", async () => {
    service.getCalendarSubscription.mockResolvedValue(sub());
    service.updateCalendarSubscriptionOptions.mockResolvedValue(
      sub({ include_rehearsals: false })
    );
    renderModal();

    await userEvent.click(await screen.findByLabelText("Rehearsals"));
    expect(service.updateCalendarSubscriptionOptions).toHaveBeenCalledWith("sub-1", {
      include_rehearsals: false,
    });
    await waitFor(() =>
      expect((screen.getByLabelText("Shows") as HTMLInputElement).disabled).toBe(true)
    );
  });

  it("fills in the time zone of subscriptions created without one", async () => {
    service.getCalendarSubscription.mockResolvedValue(sub({ timezone: null }));
    service.updateCalendarSubscriptionOptions.mockResolvedValue(sub());
    renderModal();

    await screen.findByText("Times in America/Panama");
    expect(service.updateCalendarSubscriptionOptions).toHaveBeenCalledWith("sub-1", {
      timezone: "America/Panama",
    });
  });

  it("shows a retry instead of 'no subscription' when loading fails", async () => {
    service.getCalendarSubscription.mockRejectedValueOnce(new Error("network"));
    renderModal();

    expect(await screen.findByText(/Couldn't load your calendar link/)).toBeTruthy();
    expect(screen.queryByText("Get calendar link")).toBeNull();

    service.getCalendarSubscription.mockResolvedValue(null);
    await userEvent.click(screen.getByRole("button", { name: /Retry/ }));
    expect(await screen.findByText("Get calendar link")).toBeTruthy();
  });
});
