import { describe, expect, it } from "vitest";
import { PermissionError, isPermissionDenied, isPermissionError, isRowFilteredError } from "../permissionError";

describe("permissionError", () => {
  it("isRowFilteredError is true only for PGRST116", () => {
    expect(isRowFilteredError({ code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" })).toBe(true);
    expect(isRowFilteredError({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isRowFilteredError(new Error("boom"))).toBe(false);
    expect(isRowFilteredError(null)).toBe(false);
    expect(isRowFilteredError("PGRST116")).toBe(false);
  });

  it("PermissionError carries its action and is recognised", () => {
    const e = new PermissionError("songs.delete");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("PermissionError");
    expect(e.action).toBe("songs.delete");
    expect(isPermissionError(e)).toBe(true);
    expect(isPermissionError(new Error("x"))).toBe(false);
  });

  it("isPermissionDenied covers both kinds and nothing else", () => {
    expect(isPermissionDenied(new PermissionError("shows.update"))).toBe(true);
    expect(isPermissionDenied({ code: "PGRST116" })).toBe(true);
    expect(isPermissionDenied({ message: "TypeError: Failed to fetch", code: "" })).toBe(false);
  });
});
