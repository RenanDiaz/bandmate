/**
 * Structural equality for JSON-like values (plain objects, arrays, primitives),
 * as read from Supabase or IndexedDB. Key order does not matter; `undefined`
 * properties count as absent, like JSON.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const other = b as unknown[];
    if (a.length !== other.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], other[i])) return false;
    return true;
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const leftKeys = Object.keys(left).filter((k) => left[k] !== undefined);
  const rightKeys = Object.keys(right).filter((k) => right[k] !== undefined);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) if (!deepEqual(left[key], right[key])) return false;
  return true;
}

/**
 * `next`, reusing `prev`'s objects wherever they are structurally equal: the
 * whole value when nothing changed, otherwise each equal entry of a record
 * (one level deep). Keeps reference identity for React across re-reads.
 */
export function shareRecord<T>(prev: Record<string, T> | undefined, next: Record<string, T>): Record<string, T> {
  if (!prev) return next;
  if (deepEqual(prev, next)) return prev;
  const shared: Record<string, T> = {};
  for (const [key, value] of Object.entries(next)) {
    shared[key] = key in prev && deepEqual(prev[key], value) ? prev[key] : value;
  }
  return shared;
}
