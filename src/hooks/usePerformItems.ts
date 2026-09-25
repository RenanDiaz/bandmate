import { useEffect, useRef, useState } from "react";
import type { SetlistItem } from "../services/setlistsService";
import { indexAfterItemsChange } from "../utils/performItems";

/**
 * Performance mode's local items and current index (extracted from
 * SetlistPerformanceView, no behaviour change).
 *
 * Takes the loaded items, and any later replacement, except while the user is
 * reordering (`isReorderMode`): leaving reorder mode picks up the latest items.
 * A replacement mid-show (row refresh, write) keeps the current item by
 * identity, not by index; a removed one leaves us on the nearest remaining item
 * (§8.2). `setSetlistItems` is the local edit (drag, save, cancel); the view
 * owns `isReorderMode`.
 */
export function usePerformItems(items: SetlistItem[], isReorderMode: boolean) {
  const [setlistItems, setSetlistItems] = useState<SetlistItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const setlistItemsRef = useRef<SetlistItem[]>([]);
  useEffect(() => {
    if (isReorderMode) return;
    const previous = setlistItemsRef.current;
    if (previous === items) return;
    setlistItemsRef.current = items;
    setSetlistItems(items);
    if (previous.length > 0) setCurrentIndex((index) => indexAfterItemsChange(previous, index, items));
  }, [items, isReorderMode]);
  useEffect(() => {
    setlistItemsRef.current = setlistItems;
  }, [setlistItems]);
  return { setlistItems, setSetlistItems, currentIndex, setCurrentIndex };
}
