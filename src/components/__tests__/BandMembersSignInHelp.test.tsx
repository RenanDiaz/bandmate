// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { bandContext, renderApp } from "../../test/renderApp";
import type { Band } from "../../services/bandsService";
import type { BandMember } from "../../services/bandMembersService";

const service = vi.hoisted(() => ({
  getBandMembers: vi.fn(),
  getBandInvitations: vi.fn(),
  sendSignInHelpEmail: vi.fn(),
}));

vi.mock("../../services/bandMembersService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/bandMembersService")>()),
  ...service,
}));

import { BandMembers } from "../BandMembers";

const member = (userId: string, role: BandMember["role"], email: string): BandMember => ({
  id: `m-${userId}`,
  band_id: 7,
  user_id: userId,
  role,
  invited_by: null,
  joined_at: "2026-01-01T00:00:00Z",
  expires_at: null,
  created_at: "2026-01-01T00:00:00Z",
  email,
});

const band = (role: Band["user_role"]) => ({ id: 7, name: "Band 7", user_role: role }) as Band;

const renderMembers = (role: Band["user_role"], currentUserId = "owner") =>
  renderApp(
    <BandMembers
      band={band(role)}
      currentUserId={currentUserId}
      onMemberChange={vi.fn()}
      onInviteClick={vi.fn()}
    />,
    { ctx: bandContext() }
  );

describe("BandMembers — sign-in help email", () => {
  beforeEach(() => {
    service.getBandMembers.mockResolvedValue([
      member("owner", "owner", "owner@x.com"),
      member("ana", "member", "ana@x.com"),
      member("leo", "guest", "leo@x.com"),
    ]);
    service.getBandInvitations.mockResolvedValue([]);
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the button to the owner for every other member, never for themselves", async () => {
    renderMembers("owner");
    await screen.findByText("ana@x.com");
    expect(screen.getAllByRole("button", { name: "Email how to sign in" })).toHaveLength(2);
  });

  it("hides it from non-owners", async () => {
    renderMembers("admin", "ana");
    await screen.findByText("ana@x.com");
    expect(screen.queryByRole("button", { name: "Email how to sign in" })).toBeNull();
  });

  it("confirms, sends to that member and reports success", async () => {
    service.sendSignInHelpEmail.mockResolvedValue({ ok: true });
    renderMembers("owner");
    await screen.findByText("ana@x.com");

    await userEvent.click(screen.getAllByRole("button", { name: "Email how to sign in" })[0]);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/ana@x\.com/)).toBeTruthy();
    expect(service.sendSignInHelpEmail).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole("button", { name: "Send email" }));
    expect(service.sendSignInHelpEmail).toHaveBeenCalledWith(7, "ana", "en");
    expect(await screen.findByText("Email sent to ana@x.com.")).toBeTruthy();
  });

  it("tells the owner how long to wait when it is too soon", async () => {
    service.sendSignInHelpEmail.mockResolvedValue({
      ok: false,
      reason: "too-soon",
      retryAfterSeconds: 290,
    });
    renderMembers("owner");
    await screen.findByText("ana@x.com");

    await userEvent.click(screen.getAllByRole("button", { name: "Email how to sign in" })[0]);
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Send email" }));
    expect(
      await screen.findByText("An email already went to ana@x.com recently. You can send another in 5 min.")
    ).toBeTruthy();
  });
});
