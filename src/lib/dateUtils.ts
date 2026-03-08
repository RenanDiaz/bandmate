/**
 * Returns today's date in local timezone as YYYY-MM-DD.
 * Avoids the UTC timezone bug from new Date().toISOString().split("T")[0],
 * which returns the UTC date, not the user's local date.
 */
export function getLocalToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Checks if a given YYYY-MM-DD date string is today in local timezone.
 */
export function isToday(dateStr: string): boolean {
  return dateStr === getLocalToday();
}
