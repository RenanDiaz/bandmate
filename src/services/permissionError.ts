/**
 * A write the current user is not allowed to make: refused by the role check
 * in a service, or filtered out by RLS (a delete/update that touched no row).
 * `action` is `<table>.<verb>` for logs; the message is not user-facing —
 * views show `t("common.noPermission")`.
 */
export class PermissionError extends Error {
  readonly name = "PermissionError";

  readonly action: string;

  constructor(action: string) {
    super(`Permission denied: ${action}`);
    this.action = action;
  }
}

export function isPermissionError(e: unknown): e is PermissionError {
  return e instanceof PermissionError;
}

/** PGRST116 on an update/delete `.single()` is a filtered row, i.e. a permission problem. */
export function isRowFilteredError(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "PGRST116";
}

/** Either of the above: the error a view turns into `common.noPermission`. */
export function isPermissionDenied(e: unknown): boolean {
  return isPermissionError(e) || isRowFilteredError(e);
}
