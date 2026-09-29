import {
  cancelDownload,
  checkForUpdates,
  collectGarbage,
  downloadSetlist,
  getFile,
  getSnapshotMeta,
  getStorageUsage,
  listInterruptedDownloads,
  listSnapshots,
  planDownload,
  removeSnapshot,
  resumeInterruptedDownloads,
  verifySnapshot,
} from "../services/offlineSetlistService";
import type { DownloadPlan } from "../services/offlineSetlistService";

/**
 * Development only: `window.__bandmateOffline` exposes the download engine so
 * it can be exercised against a real Supabase project from the console before
 * the UI (PR 2.3) exists. main.tsx loads this module behind
 * `import.meta.env.DEV`, so production builds contain none of it.
 *
 *   const o = window.__bandmateOffline
 *   const plan = await o.planDownload("<setlist id>")
 *   await o.downloadSetlist(plan)              // or: await o.download("<setlist id>")
 *   await o.listSnapshots(); await o.getStorageUsage()
 *   await o.checkForUpdates(); (await o.getSnapshotMeta("<id>")).lastDiff   // PR 3.1
 *   await o.verifySnapshot("<setlist id>")
 */
const hook = {
  planDownload,
  downloadSetlist: (plan: DownloadPlan) =>
    downloadSetlist(plan, {
      onProgress: (p) =>
        console.debug(
          `[offline] ${p.state} ${p.filesDone}/${p.filesTotal} files, ${p.bytesDone}/${p.bytesTotal} bytes`,
          p.currentFile ?? ""
        ),
    }),
  /** planDownload + downloadSetlist in one call. */
  download: async (setlistId: string) => hook.downloadSetlist(await planDownload(setlistId)),
  listSnapshots,
  getStorageUsage,
  listInterruptedDownloads,
  resumeInterruptedDownloads,
  cancelDownload,
  removeSnapshot,
  collectGarbage,
  getFile,
  getSnapshotMeta,
  checkForUpdates,
  verifySnapshot,
};

declare global {
  interface Window {
    __bandmateOffline?: typeof hook;
  }
}

export function installOfflineDevHook(): void {
  window.__bandmateOffline = hook;
}
