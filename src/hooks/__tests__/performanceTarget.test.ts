import { describe, expect, it } from "vitest";
import { isSongTarget, performanceTargetKey } from "../performanceTarget";

describe("performanceTargetKey (song-performance §3.1)", () => {
  it("a setlist target keys by its setlist id, a song target by song:<id>", () => {
    expect(performanceTargetKey({ kind: "setlist", setlistId: "s1" })).toBe("s1");
    expect(performanceTargetKey({ kind: "song", songId: "x" })).toBe("song:x");
  });

  it("isSongTarget", () => {
    expect(isSongTarget({ kind: "song", songId: "x" })).toBe(true);
    expect(isSongTarget({ kind: "setlist", setlistId: "s1" })).toBe(false);
  });
});
