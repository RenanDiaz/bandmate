import { describe, expect, it } from "vitest";
import { indexAfterItemsChange } from "../performItems";
import type { SetlistItem } from "../../services/setlistsService";

const s = (songId: string, position = 0): SetlistItem => ({ type: "song", song_id: songId, position });
const brk = (id: string, position = 0): SetlistItem => ({ type: "break", id, label: "Break", position });

const before = [s("a"), brk("b1"), s("c"), s("d"), s("e")];

describe("indexAfterItemsChange (§8.2: keep the current item by identity)", () => {
  it("follows the current song when rows are reordered", () => {
    // On "d" (index 3); a bandmate moves it to the top.
    expect(indexAfterItemsChange(before, 3, [s("d"), s("a"), brk("b1"), s("c"), s("e")])).toBe(0);
  });

  it("follows a special item by its id", () => {
    expect(indexAfterItemsChange(before, 1, [s("a"), s("c"), brk("b1"), s("d"), s("e")])).toBe(2);
  });

  it("current item removed → the next remaining item, not the start", () => {
    // On "c" (index 2); "c" is removed: "d" moved up into its slot.
    expect(indexAfterItemsChange(before, 2, [s("a"), brk("b1"), s("d"), s("e")])).toBe(2);
  });

  it("current and following items removed → the nearest preceding one", () => {
    expect(indexAfterItemsChange(before, 3, [s("a"), brk("b1"), s("c")])).toBe(2);
  });

  it("everything replaced → clamped, never beyond the end", () => {
    expect(indexAfterItemsChange(before, 4, [s("x"), s("y")])).toBe(1);
    expect(indexAfterItemsChange(before, 2, [])).toBe(0);
  });

  it("unchanged items → same index", () => {
    expect(indexAfterItemsChange(before, 4, [...before])).toBe(4);
  });
});
