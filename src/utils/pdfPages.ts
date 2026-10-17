/**
 * Pages the sheet music viewer keeps rendered: the current one plus `radius`
 * on each side, clamped to the document. Before the page count is known only
 * the current page.
 */
export function pagesAround(current: number, numPages: number | null, radius: number): number[] {
  if (!numPages) return [current];
  const first = Math.max(1, current - radius);
  const last = Math.min(numPages, current + radius);
  const pages: number[] = [];
  for (let page = first; page <= last; page++) pages.push(page);
  return pages;
}

/**
 * Width that fits a page of `aspect` (width / height) inside the container:
 * full width when it fits vertically, else constrained by height (min 280 px).
 * Without an aspect yet, the container width.
 */
export function fitPageWidth(containerWidth: number, containerHeight: number, aspect: number | undefined): number {
  if (!aspect) return containerWidth;
  if (containerWidth / aspect <= containerHeight) return containerWidth;
  return Math.max(280, Math.min(containerHeight * aspect, containerWidth));
}
