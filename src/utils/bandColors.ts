import { theme } from "../theme";

/**
 * Colours that tell bands apart in cross-band lists (My upcoming events'
 * date block). Every entry is dark enough for the block's white text
 * (≥ 4.5:1, except the brand gradient, which is the app's own purple).
 * The first entry is the brand gradient, so the first band looks as before.
 */
export const BAND_COLORS = [
  { key: "violet", background: theme.gradients.brandPrimary },
  { key: "cyan", background: "#0E7490" },
  { key: "emerald", background: "#047857" },
  { key: "amber", background: "#B45309" },
  { key: "rose", background: "#BE123C" },
  { key: "blue", background: "#1D4ED8" },
  { key: "fuchsia", background: "#A21CAF" },
  { key: "orange", background: "#C2410C" },
] as const;

export type BandColor = (typeof BAND_COLORS)[number];
export type BandColorKey = BandColor["key"];

/**
 * One colour per band, by the band's position among the given ids sorted
 * ascending: distinct for up to `BAND_COLORS.length` bands, then it wraps.
 * The same set of bands always gets the same colours, whatever order the
 * ids come in; joining or leaving a band can shift the bands after it.
 */
export function bandColorMap(bandIds: readonly number[]): Map<number, BandColor> {
  const sorted = [...new Set(bandIds)].sort((a, b) => a - b);
  return new Map(sorted.map((id, index) => [id, BAND_COLORS[index % BAND_COLORS.length]]));
}
