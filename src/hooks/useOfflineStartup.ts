import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useBandContext } from "../context/useBandContext";
import { useToast } from "../context/useToast";
import { getOfflineDownloadController } from "../context/offlineDownloadController";
import { collectGarbage } from "../services/offlineSetlistService";
import { failureMessageKey } from "../lib/offlineDownloadUi";
import { isOfflineDownloadsEnabled } from "../lib/featureFlags";

/**
 * App start (§4.4, §4.6): resume interrupted downloads, then collect garbage.
 * Runs once the user is known — with a valid session (journals with files left
 * to fetch resume) or in "offline-cached" (only journals whose files are all
 * stored commit; the service enforces it) — and again when the connection
 * comes back with a session. Call once, from AppContent. Runs even with the
 * offline-downloads flag off (harmless on an empty store); only its toast is gated.
 */
export function useOfflineStartup(): void {
  const { user, authMode, isCheckingAuth, isOnline } = useBandContext();
  const toast = useToast();
  const { t } = useTranslation();
  const userId = user?.id ?? null;
  const eligible = !isCheckingAuth && !!userId && (authMode === "session" || authMode === "offline-cached");
  const trigger = eligible ? `${userId}:${authMode}:${authMode === "session" && isOnline}` : null;

  useEffect(() => {
    if (!trigger) return;
    let cancelled = false;
    void getOfflineDownloadController()
      .resume()
      .then(async ({ staleDiscarded }) => {
        await collectGarbage();
        // Resumed results are announced by useOfflineDownloadNotifier (or shown by an open page).
        if (!cancelled && staleDiscarded > 0 && isOfflineDownloadsEnabled()) toast.info(t("offline.startup.stale", { count: staleDiscarded }));
      });
    return () => {
      cancelled = true;
    };
    // toast/t are stable enough; re-running on them would resume twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
}

/**
 * Downloads that end with nobody looking (the modal was hidden, the page was
 * left, or a resume ran in the background) are announced with a toast. A page
 * or modal that shows the result itself claims it (`attachViewer`). Call once,
 * from AppContent.
 */
export function useOfflineDownloadNotifier(): void {
  const toast = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    const controller = getOfflineDownloadController();
    const check = () => {
      for (const result of Object.values(controller.getState().results)) {
        // Clearing re-enters check(); skip what that already handled.
        if (!controller.getState().results[result.setlistId] || controller.isViewed(result.setlistId)) continue;
        controller.clearResult(result.setlistId);
        if (!isOfflineDownloadsEnabled()) continue; // flag off (PR 2.5 removes it): nothing to announce
        const setlist = result.meta?.setlistName ?? "";
        if (result.state === "done") toast.success(t("offline.startup.resumed", { setlist }));
        else if (result.state === "done-with-errors") toast.warning(t("offline.startup.resumedPartial", { setlist }));
        // An interruption (offline, session lost) leaves the Resume notice; say nothing more.
        else if (result.state === "failed" && (result.failureCode === "quota-rows" || result.failureCode === "unknown"))
          toast.error(t(failureMessageKey(result.failureCode)));
      }
    };
    check();
    return controller.subscribe(check);
  }, [toast, t]);
}
