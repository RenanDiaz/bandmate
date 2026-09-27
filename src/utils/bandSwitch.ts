import type { Band } from "../services/bandsService";

/**
 * The band to select before opening a page of `bandId`, or null when no
 * switch is needed: already selected, or not one of the user's bands (the
 * page then fails its own load). Shared by `useOpenInBand` and
 * `useBandFromQuery` so a tap in the app and a tapped notification follow the
 * same rule.
 */
export function bandToSwitchTo(
  bands: readonly Band[],
  selectedBandId: number | null | undefined,
  bandId: number
): Band | null {
  const band = bands.find((b) => b.id === bandId);
  return band && band.id !== selectedBandId ? band : null;
}
