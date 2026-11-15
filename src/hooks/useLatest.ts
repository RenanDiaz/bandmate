import { useLayoutEffect, useRef } from "react";

/**
 * A ref that always holds the latest `value`. Read it from effects and event
 * listeners that must see current props and state without re-running when
 * they change (a keyboard listener, a load that must not repeat when `t`
 * changes with the language).
 */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
