import { describe, expect, it } from "vitest";
import { BAND_COLORS, bandColorMap } from "../bandColors";

describe("bandColorMap", () => {
  it("gives distinct colours by ascending id, whatever the input order", () => {
    const map = bandColorMap([30, 10, 20]);
    expect(map.get(10)?.key).toBe("violet");
    expect(map.get(20)?.key).toBe("cyan");
    expect(map.get(30)?.key).toBe("emerald");
    expect(bandColorMap([10, 20, 30])).toEqual(map);
  });

  it("wraps after the palette runs out and ignores duplicate ids", () => {
    const ids = Array.from({ length: BAND_COLORS.length + 1 }, (_, i) => i + 1);
    const map = bandColorMap([...ids, 1]);
    expect(map.size).toBe(ids.length);
    expect(new Set(ids.slice(0, BAND_COLORS.length).map((id) => map.get(id)?.key)).size).toBe(BAND_COLORS.length);
    expect(map.get(ids.length)).toBe(BAND_COLORS[0]);
  });

  it("empty input → empty map", () => {
    expect(bandColorMap([]).size).toBe(0);
  });
});
