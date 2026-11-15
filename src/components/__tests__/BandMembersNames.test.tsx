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
  setMemberNickname: vi.fn(),
}));

vi.mock("../../services/bandMembersService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/bandMembersService")>()),
  ...service,
}));

import { BandMembers } from "../BandMembers";

const member = (userId: string, role: BandMember["role"], extra: Partial<BandMember>): BandMember => ({
  id: `m-${userId}`,
  band_id: 7,
  user_id: userId,
  role,
  invited_by: null,
  joined_at: "2026-01-01T00:00:00Z",
  expires_at: null,
  created_at: "2026-01-01T00:00:00Z",
  ...extra,
});

const band = (role: Band["user_role"]) => ({ id: 7, name: "Band 7", user_role: role }) as Band;

const renderMembers = (role: Band["user_role"], currentUserId: string) =>
  renderApp(
    <BandMembers band={band(role)} currentUserId={currentUserId} onMemberChange={vi.fn()} onInviteClick={vi.fn()} />,
    { ctx: bandContext() }
  );

describe("BandMembers — names and nicknames (member-names AC1, AC2)", () => {
  beforeEach(() => {
    service.getBandMembers.mockResolvedValue([
      member("owner", "owner", { email: "owner@x.com", user_metadata: { full_name: "Renán Díaz" } }),
      member("carlos", "member", { email: "carlos@x.com", nickname: "Chino", user_metadata: { full_name: "Carlos Pérez" } }),
      member("leo", "guest", { email: "leo@x.com" }),
    ]);
    service.getBandInvitations.mockResolvedValue([]);
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows nickname, else name, else email, with the account name and email below", async () => {
    renderMembers("owner", "owner");
    expect(await screen.findByText("Chino")).toBeTruthy();
    expect(screen.getByText("Carlos Pérez · carlos@x.com")).toBeTruthy();
    expect(screen.getByText("Renán Díaz")).toBeTruthy();
    expect(screen.getByText("owner@x.com")).toBeTruthy();
    // No name: the email is the display name, not repeated below.
    expect(screen.getAllByText("leo@x.com")).toHaveLength(1);
  });

  it("the owner can edit every nickname, a member only their own", async () => {
    renderMembers("owner", "owner");
    await screen.findByText("Chino");
    expect(screen.getAllByRole("button", { name: /^Edit nickname/ })).toHaveLength(3);
    cleanup();

    renderMembers("member", "carlos");
    await screen.findByText("Chino");
    const buttons = screen.getAllByRole("button", { name: /^Edit nickname/ });
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute("aria-label")).toBe("Edit nickname: Chino");
  });

  it("saves the trimmed nickname and shows it", async () => {
    service.setMemberNickname.mockResolvedValue("Leíto");
    renderMembers("owner", "owner");
    await screen.findByText("Chino");

    await userEvent.click(screen.getByRole("button", { name: "Edit nickname: leo@x.com" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Nickname"), "  Leíto ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(service.setMemberNickname).toHaveBeenCalledWith(7, "leo", "Leíto");
    expect(await screen.findByText("Leíto")).toBeTruthy();
    expect(screen.getByText("Nickname saved")).toBeTruthy();
  });
});
