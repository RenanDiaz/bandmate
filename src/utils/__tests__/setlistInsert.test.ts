import { describe, expect, it } from "vitest";
import type { SetlistItem } from "../../services/setlistsService";
import { insertSongs } from "../setlistInsert";

const items: SetlistItem[] = [
  { type: "section", id: "sec", label: "Set 1", position: 0 },
  { type: "song", song_id: "a", position: 1, notes: "capo 2" },
  { type: "break", id: "brk", label: "Break", duration: 10, position: 2 },
];

const order = (list: SetlistItem[]) => list.map((item) => (item.type === "song" ? item.song_id : item.id));

describe("insertSongs", () => {
  it("appends in the given order and reindexes positions", () => {
    const result = insertSongs(items, ["c", "b"]);
    expect(order(result)).toEqual(["sec", "a", "brk", "c", "b"]);
    expect(result.map((item) => item.position)).toEqual([0, 1, 2, 3, 4]);
    expect(result[3]).toEqual({ type: "song", song_id: "c", position: 3, notes: "" });
  });

  it("inserts at an index, before the item there", () => {
    expect(order(insertSongs(items, ["b"], 2))).toEqual(["sec", "a", "b", "brk"]);
    expect(order(insertSongs(items, ["b"], 0))).toEqual(["b", "sec", "a", "brk"]);
  });

  it("clamps the index", () => {
    expect(order(insertSongs(items, ["b"], 99))).toEqual(["sec", "a", "brk", "b"]);
    expect(order(insertSongs(items, ["b"], -3))).toEqual(["b", "sec", "a", "brk"]);
  });

  it("skips songs already in the setlist and duplicates; returns the same array when nothing is added", () => {
    expect(order(insertSongs(items, ["a", "b", "b"]))).toEqual(["sec", "a", "brk", "b"]);
    expect(insertSongs(items, ["a"])).toBe(items);
    expect(insertSongs(items, [])).toBe(items);
  });

  it("keeps existing items' fields", () => {
    expect(insertSongs(items, ["b"], 0)[2]).toEqual({ type: "song", song_id: "a", position: 2, notes: "capo 2" });
  });
});
