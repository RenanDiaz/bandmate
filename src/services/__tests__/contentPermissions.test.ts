import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BandRole } from "../bandMembersService";
import { canEditContent, canManageEvents } from "../bandMembersService";
import { PermissionError } from "../permissionError";
import { deleteSong, updateSong } from "../songsService";
import { deleteSetlist, updateSetlist } from "../setlistsService";
import { deleteShow, updateShow } from "../showsService";
import { deleteRehearsal, updateRehearsal } from "../rehearsalsService";

/**
 * Fake Supabase for the four content services. Every query resolves from
 * `state`: the role `getUserBandRole` reads from `band_members`, and the rows a
 * delete returns (RLS filtering a row out answers 200 with no rows). Writes are
 * recorded so a test can assert none happened.
 */
const state = vi.hoisted(() => ({
  role: null as string | null,
  deletedRows: [] as Array<{ id: string }>,
  writes: [] as Array<{ table: string; op: "update" | "delete" }>,
}));

vi.mock("../../lib/supabaseClient", () => {
  function from(table: string) {
    let op: "select" | "update" | "delete" = "select";
    const result = () => {
      if (op === "delete") return { data: state.deletedRows, error: null };
      if (op === "update") return { data: { id: "row-1", band_id: 1, songs: [] }, error: null };
      if (table === "band_members") {
        return state.role ? { data: { role: state.role }, error: null } : { data: null, error: { code: "PGRST116" } };
      }
      return { data: { band_id: 1 }, error: null };
    };
    const builder = {
      select: () => builder,
      eq: () => builder,
      update: () => {
        op = "update";
        state.writes.push({ table, op });
        return builder;
      },
      delete: () => {
        op = "delete";
        state.writes.push({ table, op });
        return builder;
      },
      single: async () => result(),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(result()).then(resolve, reject),
    };
    return builder;
  }
  return {
    supabase: {
      from,
      auth: { getUser: async () => ({ data: { user: { id: "user-a" } } }) },
    },
  };
});

vi.mock("../../lib/authSession", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/authSession")>()),
  getSessionUser: vi.fn(async () => ({ id: "user-a" })),
}));

const cases = [
  { table: "songs", del: () => deleteSong("row-1"), upd: () => updateSong("row-1", { title: "x" }) },
  { table: "setlists", del: () => deleteSetlist("row-1"), upd: () => updateSetlist("row-1", { name: "x" }) },
  { table: "shows", del: () => deleteShow("row-1"), upd: () => updateShow("row-1", { name: "x" }) },
  { table: "rehearsals", del: () => deleteRehearsal("row-1"), upd: () => updateRehearsal("row-1", { name: "x" }) },
];

beforeEach(() => {
  state.role = "member";
  state.deletedRows = [];
  state.writes = [];
});

describe.each(cases)("$table service", ({ table, del, upd }) => {
  it("delete resolves when the row came back", async () => {
    state.deletedRows = [{ id: "row-1" }];
    await expect(del()).resolves.toBeUndefined();
    expect(state.writes).toEqual([{ table, op: "delete" }]);
  });

  it("delete throws PermissionError when RLS filtered the row (zero rows)", async () => {
    state.deletedRows = [];
    await expect(del()).rejects.toBeInstanceOf(PermissionError);
    await expect(del()).rejects.toMatchObject({ action: `${table}.delete` });
  });

  it.each(["guest", null])("role %s: delete and update throw before any write", async (role) => {
    state.role = role;
    state.deletedRows = [{ id: "row-1" }];
    await expect(del()).rejects.toMatchObject({ name: "PermissionError", action: `${table}.delete` });
    await expect(upd()).rejects.toMatchObject({ name: "PermissionError", action: `${table}.update` });
    expect(state.writes).toEqual([]);
  });

  it("member may update", async () => {
    await expect(upd()).resolves.toBeTruthy();
    expect(state.writes).toEqual([{ table, op: "update" }]);
  });
});

describe("role helpers", () => {
  const roles: Array<BandRole | null> = ["owner", "admin", "member", "guest", null];
  it.each(roles)("%s", (role) => {
    const allowed = role === "owner" || role === "admin" || role === "member";
    expect(canEditContent(role)).toBe(allowed);
    expect(canManageEvents(role)).toBe(allowed);
  });
});
