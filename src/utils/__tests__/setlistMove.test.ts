import { describe, expect, it } from "vitest";
import type { SetlistItem } from "../../services/setlistsService";
import { canMove, moveItem } from "../setlistMove";

const items: SetlistItem[] = [
  { type: "section", id: "sec", label: "Set 1", position: 0 },
  { type: "song", song_id: "a", position: 1, notes: "capo" },
  { type: "song", song_id: "b", position: 2 },
  { type: "break", id: "brk", label: "Break", duration: 10, position: 3 },
];

const order = (list: SetlistItem[]) => list.map((item) => (item.type === "song" ? item.song_id : item.id));

describe("moveItem", () => {
  it("moves one step up and down", () => {
    expect(order(moveItem(items, 2, "up"))).toEqual(["sec", "b", "a", "brk"]);
    expect(order(moveItem(items, 1, "down"))).toEqual(["sec", "b", "a", "brk"]);
  });

  it("moves to the top and the bottom", () => {
    expect(order(moveItem(items, 2, "top"))).toEqual(["b", "sec", "a", "brk"]);
    expect(order(moveItem(items, 0, "bottom"))).toEqual(["a", "b", "brk", "sec"]);
  });

  it("reindexes positions and keeps the other fields", () => {
    const moved = moveItem(items, 1, "bottom");
    expect(moved.map((item) => item.position)).toEqual([0, 1, 2, 3]);
    expect(moved[3]).toEqual({ type: "song", song_id: "a", position: 3, notes: "capo" });
  });

  it("returns the same array at the ends and for a bad index", () => {
    expect(moveItem(items, 0, "up")).toBe(items);
    expect(moveItem(items, 0, "top")).toBe(items);
    expect(moveItem(items, 3, "down")).toBe(items);
    expect(moveItem(items, 3, "bottom")).toBe(items);
    expect(moveItem(items, 9, "up")).toBe(items);
    expect(moveItem(items, -1, "down")).toBe(items);
  });
});

describe("canMove", () => {
  it("is false at the ends, and for a single item", () => {
    expect(canMove(0, 4, "up")).toBe(false);
    expect(canMove(0, 4, "down")).toBe(true);
    expect(canMove(3, 4, "bottom")).toBe(false);
    expect(canMove(3, 4, "top")).toBe(true);
    expect(canMove(0, 1, "down")).toBe(false);
  });
});
