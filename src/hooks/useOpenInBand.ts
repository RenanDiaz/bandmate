import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useBandContext } from "../context/useBandContext";
import { useToast } from "../context/useToast";

/**
 * Navigate to a band-scoped page, selecting that band first when it is not
 * the current one (the detail views take role and header from selectedBand).
 * Unknown bandId (not in `bands`): navigates anyway without switching — the
 * page will fail its own load; the hook never throws.
 *
 * The switch and the navigation happen in the same handler, so React batches
 * them and the page's first render already has the new band. Don't move the
 * navigate into an effect: that adds a frame of the old band's header.
 * BandStorage is written by BandContext's own effect.
 */
export function useOpenInBand(): (bandId: number, path: string) => void {
  const { bands, selectedBand, setSelectedBand } = useBandContext();
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useTranslation();

  return useCallback(
    (bandId: number, path: string) => {
      const band = bands.find((b) => b.id === bandId);
      const switching = !!band && band.id !== selectedBand?.id;
      if (switching) setSelectedBand(band);
      navigate(path);
      if (switching) toast.info(t("home.switchedToBand", { band: band.name }));
    },
    [bands, selectedBand, setSelectedBand, navigate, toast, t]
  );
}
