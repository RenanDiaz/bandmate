import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBandMemberNames, setMemberNickname } from "../bandMembersService";
import { PermissionError } from "../permissionError";

type RpcAnswer = { data: unknown; error: { code?: string; message?: string } | null };
const state = vi.hoisted(() => ({
  calls: [] as { fn: string; args: Record<string, unknown> }[],
  answer: (() => ({ data: null, error: null })) as (fn: string, args: Record<string, unknown>) => RpcAnswer,
}));

vi.mock("../../lib/supabaseClient", () => ({
  supabase: {
    auth: {},
    rpc: (fn: string, args: Record<string, unknown>) => {
      state.calls.push({ fn, args });
      return Promise.resolve(state.answer(fn, args));
    },
  },
}));

beforeEach(() => {
  state.calls = [];
});

describe("setMemberNickname (member-names AC2, AC3)", () => {
  it("sends the nickname ('' clears) and returns the stored value", async () => {
    state.answer = () => ({ data: "Chino", error: null });
    expect(await setMemberNickname(7, "u1", "Chino")).toBe("Chino");
    expect(state.calls[0]).toEqual({
      fn: "set_band_member_nickname",
      args: { band_id_param: 7, user_id_param: "u1", nickname_param: "Chino" },
    });

    state.answer = () => ({ data: null, error: null });
    expect(await setMemberNickname(7, "u1", null)).toBeNull();
    expect(state.calls[1].args.nickname_param).toBe("");
  });

  it("a refusal (42501) is a PermissionError; other errors pass through", async () => {
    state.answer = () => ({ data: null, error: { code: "42501", message: "Only the band owner…" } });
    await expect(setMemberNickname(7, "u2", "X")).rejects.toBeInstanceOf(PermissionError);

    state.answer = () => ({ data: null, error: { code: "22001", message: "Nickname too long" } });
    await expect(setMemberNickname(7, "u2", "X")).rejects.toMatchObject({ code: "22001" });
  });
});

describe("getBandMemberNames (member-names AC4)", () => {
  it("one call for every id, deduplicated; unnamed ids are absent", async () => {
    state.answer = () => ({
      data: [
        { user_id: "u1", display_name: "Chino" },
        { user_id: "u2", display_name: null },
      ],
      error: null,
    });
    expect(await getBandMemberNames(7, ["u1", "u2", "u1", ""])).toEqual({ u1: "Chino" });
    expect(state.calls).toEqual([{ fn: "get_band_member_names", args: { band_id_param: 7, user_ids: ["u1", "u2"] } }]);
  });

  it("no ids → no request", async () => {
    expect(await getBandMemberNames(7, [])).toEqual({});
    expect(state.calls).toEqual([]);
  });

  it("without the RPC (migration not applied) falls back to one lookup per id", async () => {
    state.answer = (fn, args) =>
      fn === "get_band_member_names"
        ? { data: null, error: { code: "PGRST202", message: "Could not find the function" } }
        : { data: args.user_id_param === "u1" ? "Carlos Pérez" : null, error: null };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await getBandMemberNames(7, ["u1", "u2"])).toEqual({ u1: "Carlos Pérez" });
    expect(state.calls.filter((c) => c.fn === "get_user_display_name")).toHaveLength(2);
    warn.mockRestore();
  });
});
