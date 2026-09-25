// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { SetlistItem } from "../../services/setlistsService";
import { usePerformItems } from "../usePerformItems";

const s = (songId: string, position = 0): SetlistItem => ({ type: "song", song_id: songId, position });
const ids = (list: SetlistItem[]) => list.map((i) => (i.type === "song" ? i.song_id : i.id));

// Retroactive (PR 2.1 / 2.4 rule): a session emits full-row replacements; the
// view must not reseed its local items while the user is reordering.
describe("usePerformItems (SetlistPerformanceView's reseed rule)", () => {
  const loaded = [s("a", 0), s("b", 1), s("c", 2)];

  function setup() {
    return renderHook(({ items, reorder }) => usePerformItems(items, reorder), {
      initialProps: { items: loaded, reorder: false },
    });
  }

  it("seeds from the loaded items at index 0", () => {
    const { result } = setup();
    expect(ids(result.current.setlistItems)).toEqual(["a", "b", "c"]);
    expect(result.current.currentIndex).toBe(0);
  });

  it("does not reseed while in reorder mode when new rows are emitted", () => {
    const { result, rerender } = setup();
    rerender({ items: loaded, reorder: true });
    // The user drags "c" to the top (local edit).
    act(() => result.current.setSetlistItems([s("c", 0), s("a", 1), s("b", 2)]));
    // A background refresh emits a replacement meanwhile.
    rerender({ items: [s("b", 0), s("a", 1), s("c", 2), s("d", 3)], reorder: true });
    expect(ids(result.current.setlistItems)).toEqual(["c", "a", "b"]);
  });

  it("leaving reorder mode picks up the latest emitted rows", () => {
    const { result, rerender } = setup();
    rerender({ items: loaded, reorder: true });
    const latest = [s("b", 0), s("a", 1), s("c", 2), s("d", 3)];
    rerender({ items: latest, reorder: true });
    rerender({ items: latest, reorder: false });
    expect(ids(result.current.setlistItems)).toEqual(["b", "a", "c", "d"]);
  });

  it("a replacement outside reorder mode keeps the current item by identity", () => {
    const { result, rerender } = setup();
    act(() => result.current.setCurrentIndex(2)); // on "c"
    rerender({ items: [s("c", 0), s("a", 1), s("b", 2)], reorder: false });
    expect(ids(result.current.setlistItems)).toEqual(["c", "a", "b"]);
    expect(result.current.currentIndex).toBe(0);
  });

  it("re-rendering with the same items reference does not reseed a local edit", () => {
    const { result, rerender } = setup();
    act(() => result.current.setSetlistItems([s("b", 0), s("a", 1), s("c", 2)]));
    rerender({ items: loaded, reorder: false });
    expect(ids(result.current.setlistItems)).toEqual(["b", "a", "c"]);
  });
});
