import { describe, expect, it, vi } from "vitest";
import { getCountryDistribution } from "../reportsService";

const state = vi.hoisted(() => ({ rows: [] as unknown[] }));

vi.mock("../../lib/supabaseClient", () => {
  function from() {
    const builder: Record<string, unknown> = {
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ data: state.rows, error: null }).then(resolve, reject),
    };
    for (const method of ["select", "eq", "not", "neq"]) builder[method] = () => builder;
    return builder;
  }
  return { supabase: { from, auth: {} } };
});

describe("getCountryDistribution (song-country-language AC5)", () => {
  it("groups codes and the spellings that normalise to them; keeps unknown values as their own rows", async () => {
    state.rows = ["US", "USA", "Estados Unidos", "MX", "", null, "Scotland", " us "].map((country) => ({ country }));
    expect(await getCountryDistribution(7)).toEqual([
      { country: "US", count: 4 },
      { country: "MX", count: 1 },
      { country: "Scotland", count: 1 },
    ]);
  });
});
