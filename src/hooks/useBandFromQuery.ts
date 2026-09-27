import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useBandContext } from "../context/useBandContext";
import { useToast } from "../context/useToast";
import { bandToSwitchTo } from "../utils/bandSwitch";

export const BAND_QUERY_PARAM = "band";

/**
 * `?band=<id>` on any route (a tapped push notification,
 * docs/specs/band-push-notifications.md §1 decision 6): select that band when
 * it is one of the user's and not the current one, then drop the param with a
 * `replace`, like `useOpenInBand`. Unknown band → only the param goes.
 *
 * Returns true while the param waits to be applied (user known, bands
 * resolved), so AppMain renders a spinner instead of one frame of the page in
 * the old band. The switch and the navigate run in the same effect, so React
 * batches them.
 */
export function useBandFromQuery(): boolean {
  const { user, bands, selectedBand, setSelectedBand, isCheckingAuth, isResolvingBand } = useBandContext();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useTranslation();
  const handledKey = useRef<string | null>(null);

  const raw = new URLSearchParams(location.search).get(BAND_QUERY_PARAM);
  const pending = raw !== null && !!user && !isCheckingAuth && !isResolvingBand;

  useEffect(() => {
    if (!pending || raw === null) return;
    // StrictMode runs effects twice: one switch and one toast per location.
    if (handledKey.current === location.key) return;
    handledKey.current = location.key;

    const bandId = Number(raw);
    const band = Number.isSafeInteger(bandId) ? bandToSwitchTo(bands, selectedBand?.id, bandId) : null;
    if (band) setSelectedBand(band);

    const params = new URLSearchParams(location.search);
    params.delete(BAND_QUERY_PARAM);
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : "", hash: location.hash }, { replace: true });
    if (band) toast.info(t("home.switchedToBand", { band: band.name }));
  }, [pending, raw, bands, selectedBand, setSelectedBand, location, navigate, toast, t]);

  return pending;
}
