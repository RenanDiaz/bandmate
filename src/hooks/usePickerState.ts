import { useCallback, useState } from "react";
import { parseStoredPickerState, type PickerState } from "../utils/songFilters";

/** One JSON object per device (spec §3.3): the picker's filters and sort. */
export const PICKER_STATE_KEY = "bandmate_setlist_picker";

function readPickerState(): PickerState {
  try {
    return parseStoredPickerState(localStorage.getItem(PICKER_STATE_KEY));
  } catch {
    // Blocked storage: defaults.
    return parseStoredPickerState(null);
  }
}

/** The setlist picker's filters and sort, remembered on this device. */
export function usePickerState(): [PickerState, (next: PickerState) => void] {
  const [state, setState] = useState<PickerState>(readPickerState);

  const update = useCallback((next: PickerState) => {
    setState(next);
    try {
      localStorage.setItem(PICKER_STATE_KEY, JSON.stringify(next));
    } catch {
      // Not remembered on this device; the choice still applies now.
    }
  }, []);

  return [state, update];
}
