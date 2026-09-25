import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import en from "../../../i18n/locales/en.json";
import type { FinishedDownload } from "../../../context/offlineDownloadController";
import type { PlanSummary } from "../../../lib/offlineDownloadUi";
import type { OfflineSnapshot, OfflineSnapshotMeta } from "../../../services/offlineSetlistService";
import {
  OfflineDownloadConfirmBody,
  OfflineDownloadProgressBody,
  OfflineDownloadResultBody,
} from "../OfflineDownloadBodies";

const i18n = i18next.createInstance();
void i18n.use(initReactI18next).init({
  lng: "en",
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false },
  initImmediate: false,
});

function render(element: ReactElement): string {
  // Strip tags so assertions read like the rendered text.
  return renderToStaticMarkup(<I18nextProvider i18n={i18n}>{element}</I18nextProvider>)
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");
}

function html(element: ReactElement): string {
  return renderToStaticMarkup(<I18nextProvider i18n={i18n}>{element}</I18nextProvider>);
}

const summary: PlanSummary = {
  songCount: 3,
  filesToDownload: 4,
  bytesToDownload: 42_000_000,
  filesWithUnknownSize: 1,
  filesAlreadyPresent: 2,
  bytesAlreadyPresent: 3_500_000,
  freeBytes: 30_000_000,
  quotaWarning: false,
};
const desktop = { ios: false, standalone: false };

describe("OfflineDownloadConfirmBody (A1)", () => {
  it("shows songs, PDFs, approximate size, files already present and unknown sizes", () => {
    const text = render(<OfflineDownloadConfirmBody summary={summary} platform={desktop} />);
    expect(text).toContain("3 songs");
    expect(text).toContain("4 PDFs to download");
    expect(text).toContain("about 42 MB");
    expect(text).toContain("+ 1 file of unknown size");
    expect(text).toContain("2 files already on this device (3.5 MB)");
    expect(text).not.toContain("enough free space");
    expect(text).not.toContain("in this app");
  });

  it("warns about quota and still renders the rest", () => {
    const text = render(<OfflineDownloadConfirmBody summary={{ ...summary, quotaWarning: true }} platform={desktop} />);
    expect(text).toContain("may not have enough free space (about 30 MB free)");
  });

  it("says nothing new to download when every file is present (A3)", () => {
    const text = render(
      <OfflineDownloadConfirmBody
        summary={{ ...summary, filesToDownload: 0, bytesToDownload: 0, filesWithUnknownSize: 0 }}
        platform={desktop}
      />
    );
    expect(text).toContain("Nothing new to download");
  });

  it("iOS installed app: 'Saved on this device, in this app', no install hint", () => {
    const out = html(<OfflineDownloadConfirmBody summary={summary} platform={{ ios: true, standalone: true }} />);
    expect(out).toContain("Saved on this device, in this app.");
    expect(out).not.toContain("offline-ios-hint");
  });

  it("iOS browser tab: install hint (§9.1)", () => {
    const out = html(<OfflineDownloadConfirmBody summary={summary} platform={{ ios: true, standalone: false }} />);
    expect(out).toContain("offline-ios-hint");
    expect(out).toContain("Add to Home Screen");
  });
});

describe("OfflineDownloadProgressBody", () => {
  it("shows files, bytes, the current song and PDF, and the keep-open note", () => {
    const text = render(
      <OfflineDownloadProgressBody
        progress={{
          state: "downloading",
          filesDone: 2,
          filesTotal: 5,
          bytesDone: 12_000_000,
          bytesTotal: 40_000_000,
          currentFile: { songTitle: "Wonderwall", name: "Guitar" },
        }}
      />
    );
    expect(text).toContain("2 of 5 files");
    expect(text).toContain("12 MB of 40 MB");
    expect(text).toContain("Wonderwall — Guitar");
    expect(text).toContain("Keep the app open until the download finishes.");
  });
});

const baseMeta = {
  schemaVersion: 1,
  setlistId: "s1",
  savedAt: "2026-09-25T10:00:00.000Z",
  setlistName: "Friday",
} as OfflineSnapshotMeta;

function finished(overrides: Partial<FinishedDownload>): FinishedDownload {
  return {
    setlistId: "s1",
    state: "done",
    meta: baseMeta,
    missingFiles: [],
    failureCode: null,
    finishedAt: "2026-09-25T10:00:00.000Z",
    ...overrides,
  };
}

describe("OfflineDownloadResultBody", () => {
  it("done: 'Available offline · {date}' (A2)", () => {
    const text = render(<OfflineDownloadResultBody result={finished({})} snapshot={null} runningSetlistName={null} />);
    expect(text).toMatch(/Available offline · Sep 25, 2026/);
  });

  it("done-with-errors: missing PDFs grouped by song with reasons (A6)", () => {
    const snapshot = {
      songsById: { a: { title: "Song A" }, b: { title: "Song B" } },
      sheetMusicBySongId: { a: [{ id: "x", name: "Lead" }], b: [{ id: "y", name: "Bass" }] },
    } as unknown as Pick<OfflineSnapshot, "songsById" | "sheetMusicBySongId">;
    const text = render(
      <OfflineDownloadResultBody
        result={finished({
          state: "done-with-errors",
          missingFiles: [
            { storagePath: "p1", sheetMusicId: "x", songId: "a", reason: "quota", bytes: 40_000_000 },
            { storagePath: "p2", sheetMusicId: "y", songId: "b", reason: "network", bytes: null },
          ],
        })}
        snapshot={snapshot}
        runningSetlistName={null}
      />
    );
    expect(text).toContain("Song A");
    expect(text).toContain("Lead — not enough space (40 MB)");
    expect(text).toContain("Song B");
    expect(text).toContain("Bass — connection lost");
  });

  it.each([
    ["offline", "You're offline"],
    ["quota-rows", "Remove another offline setlist"],
    ["not-authenticated", "Sign in again"],
    ["plan-stale", "out of date"],
    ["storage-unavailable", "private browsing"],
    ["unknown", "Something went wrong"],
  ] as const)("failed %s: reason-specific message", (code, expected) => {
    const text = render(
      <OfflineDownloadResultBody
        result={finished({ state: "failed", meta: null, failureCode: code })}
        snapshot={null}
        runningSetlistName={null}
      />
    );
    expect(text).toContain(expected);
  });

  it("download-in-progress names the running setlist when this tab runs it", () => {
    const text = render(
      <OfflineDownloadResultBody
        result={finished({ state: "failed", meta: null, failureCode: "download-in-progress" })}
        snapshot={null}
        runningSetlistName="Saturday"
      />
    );
    expect(text).toContain("“Saturday” is downloading");
  });

  it("download-in-progress in another tab", () => {
    const text = render(
      <OfflineDownloadResultBody
        result={finished({ state: "failed", meta: null, failureCode: "download-in-progress" })}
        snapshot={null}
        runningSetlistName={null}
      />
    );
    expect(text).toContain("another Bandmate tab or window");
  });
});
