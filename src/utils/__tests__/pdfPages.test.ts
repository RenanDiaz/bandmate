import { describe, expect, it } from "vitest";
import { fitPageWidth, pagesAround } from "../pdfPages";

describe("pagesAround", () => {
  it("is only the current page before the page count is known", () => {
    expect(pagesAround(3, null, 1)).toEqual([3]);
  });

  it("keeps the neighbours of a middle page", () => {
    expect(pagesAround(3, 5, 1)).toEqual([2, 3, 4]);
  });

  it("clamps to the first and last page", () => {
    expect(pagesAround(1, 5, 1)).toEqual([1, 2]);
    expect(pagesAround(5, 5, 1)).toEqual([4, 5]);
    expect(pagesAround(1, 1, 1)).toEqual([1]);
  });
});

describe("fitPageWidth", () => {
  it("uses the container width without an aspect", () => {
    expect(fitPageWidth(800, 600, undefined)).toBe(800);
  });

  it("uses the full width when the page fits vertically", () => {
    expect(fitPageWidth(800, 600, 2)).toBe(800);
  });

  it("constrains by height when the page would overflow", () => {
    expect(fitPageWidth(800, 600, 0.75)).toBe(450);
  });

  it("never goes below 280 px", () => {
    expect(fitPageWidth(800, 100, 0.75)).toBe(280);
  });
});
