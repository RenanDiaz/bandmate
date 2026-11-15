import { beforeEach, describe, expect, it } from "vitest";
import {
  SETLIST_CANDIDATES_MAX_AGE_MS,
  clearAllCandidates,
  readCandidates,
  setlistCandidatesKey,
  writeCandidates,
} from "../setlistCandidates";

beforeEach(() => localStorage.clear());

describe("setlist candidates (setlist-builder §5)", () => {
  it("round-trips per user and setlist, in starring order, without duplicates", () => {
    const now = new Date("2026-11-14T20:00:00Z");
    writeCandidates("u1", "s1", ["b", "a", "b"], now);
    expect(readCandidates("u1", "s1", now.getTime())).toEqual(["b", "a"]);
    expect(readCandidates("u2", "s1", now.getTime())).toEqual([]);
    expect(readCandidates("u1", "s2", now.getTime())).toEqual([]);
  });

  it("an empty list removes the key", () => {
    writeCandidates("u1", "s1", ["a"]);
    writeCandidates("u1", "s1", []);
    expect(localStorage.getItem(setlistCandidatesKey("u1", "s1"))).toBeNull();
  });

  it("a list untouched for more than 30 days is discarded and removed", () => {
    const saved = new Date("2026-10-01T08:00:00Z");
    writeCandidates("u1", "s1", ["a"], saved);
    expect(readCandidates("u1", "s1", saved.getTime() + SETLIST_CANDIDATES_MAX_AGE_MS)).toEqual(["a"]);
    expect(readCandidates("u1", "s1", saved.getTime() + SETLIST_CANDIDATES_MAX_AGE_MS + 1)).toEqual([]);
    expect(localStorage.getItem(setlistCandidatesKey("u1", "s1"))).toBeNull();
  });

  it("a corrupt value reads as empty and is removed", () => {
    const key = setlistCandidatesKey("u1", "s1");
    for (const raw of ["not json", "null", "[]", '{"songIds":[1],"savedAt":"2026-11-14T00:00:00Z"}', '{"songIds":["a"]}']) {
      localStorage.setItem(key, raw);
      expect(readCandidates("u1", "s1")).toEqual([]);
      expect(localStorage.getItem(key)).toBeNull();
    }
  });

  it("wipeAll's clearAllCandidates removes them and nothing else", () => {
    writeCandidates("u1", "s1", ["a"]);
    writeCandidates("u2", "s2", ["b"]);
    localStorage.setItem("bandmate_setlist_picker", "{}");
    clearAllCandidates();
    expect(readCandidates("u1", "s1")).toEqual([]);
    expect(readCandidates("u2", "s2")).toEqual([]);
    expect(localStorage.getItem("bandmate_setlist_picker")).toBe("{}");
  });
});
