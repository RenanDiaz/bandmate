import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLocalToday } from "../../lib/dateUtils";
import { getUpcomingShowsForBands } from "../showsService";
import { getUpcomingRehearsalsForBands } from "../rehearsalsService";

/** Fake Supabase: records every builder call and resolves with `state.rows`. */
const state = vi.hoisted(() => ({
  calls: [] as Array<[string, ...unknown[]]>,
  rows: [] as unknown[],
}));

vi.mock("../../lib/supabaseClient", () => {
  function from(table: string) {
    state.calls.push(["from", table]);
    const builder: Record<string, unknown> = {
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ data: state.rows, error: null }).then(resolve, reject),
    };
    for (const method of ["select", "in", "eq", "gte", "order"]) {
      builder[method] = (...args: unknown[]) => {
        state.calls.push([method, ...args]);
        return builder;
      };
    }
    return builder;
  }
  return { supabase: { from, auth: {} } };
});

beforeEach(() => {
  state.calls = [];
  state.rows = [];
});

const cases = [
  { fn: getUpcomingShowsForBands, table: "shows", status: "upcoming", column: "event_date" },
  { fn: getUpcomingRehearsalsForBands, table: "rehearsals", status: "scheduled", column: "rehearsal_date" },
];

describe.each(cases)("$table for several bands (AC2)", ({ fn, table, status, column }) => {
  it("no ids: resolves [] without calling Supabase", async () => {
    await expect(fn([])).resolves.toEqual([]);
    expect(state.calls).toEqual([]);
  });

  it("ids: one query filtered by in(band_id), status and today, ordered by date", async () => {
    state.rows = [{ id: "e1" }];
    await expect(fn([1, 2, 3])).resolves.toEqual([{ id: "e1" }]);
    expect(state.calls).toEqual([
      ["from", table],
      ["select", "*"],
      ["in", "band_id", [1, 2, 3]],
      ["eq", "status", status],
      ["gte", column, getLocalToday()],
      ["order", column, { ascending: true }],
    ]);
  });
});
