import { describe, expect, it } from "vitest";
import en from "../../i18n/locales/en.json";
import es from "../../i18n/locales/es.json";
import type { DownloadPlan, OfflineMissingFile, OfflineSnapshot } from "../../services/offlineSetlistService";
import {
  FAILURE_CODES,
  failureMessageKey,
  formatBytes,
  groupMissingBySong,
  quotaWarning,
  reasonKey,
  summarizePlan,
} from "../offlineDownloadUi";

function plan(overrides: Partial<DownloadPlan> = {}): DownloadPlan {
  return {
    setlistId: "s1",
    bandId: 1,
    songCount: 3,
    filesToDownload: [
      { storagePath: "1/a/x.pdf", sheetMusicId: "x", songId: "a", rowUpdatedAt: "", bytes: 1_000_000 },
      { storagePath: "1/b/y.pdf", sheetMusicId: "y", songId: "b", rowUpdatedAt: "", bytes: null },
    ],
    filesAlreadyPresent: [{ storagePath: "1/c/z.pdf", sheetMusicId: "z", songId: "c", rowUpdatedAt: "" }],
    filesToDelete: [],
    bytesToDownload: 1_000_000,
    filesWithUnknownSize: 1,
    bytesAlreadyPresent: 500_000,
    estimate: { usage: 0, quota: 10_000_000 },
    ...overrides,
  };
}

function lookup(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);
}

describe("quotaWarning (§4.5: headroom < 110 % of bytesToDownload)", () => {
  it("warns below 110 % and not at or above it", () => {
    expect(quotaWarning({ bytesToDownload: 1000, estimate: { usage: 0, quota: 1099 } })).toBe(true);
    expect(quotaWarning({ bytesToDownload: 1000, estimate: { usage: 0, quota: 1100 } })).toBe(false);
    expect(quotaWarning({ bytesToDownload: 1000, estimate: { usage: 500, quota: 1500 } })).toBe(true);
  });

  it("never warns without an estimate", () => {
    expect(quotaWarning({ bytesToDownload: 1e12, estimate: null })).toBe(false);
  });
});

describe("summarizePlan", () => {
  it("counts files to download, unknown sizes and files already present", () => {
    expect(summarizePlan(plan())).toEqual({
      songCount: 3,
      filesToDownload: 2,
      bytesToDownload: 1_000_000,
      filesWithUnknownSize: 1,
      filesAlreadyPresent: 1,
      bytesAlreadyPresent: 500_000,
      freeBytes: 10_000_000,
      quotaWarning: false,
    });
  });

  it("a plan with everything present (A3) has nothing to download", () => {
    const s = summarizePlan(plan({ filesToDownload: [], bytesToDownload: 0, filesWithUnknownSize: 0 }));
    expect(s.filesToDownload).toBe(0);
    expect(s.quotaWarning).toBe(false);
  });
});

describe("formatBytes", () => {
  it("uses decimal units, one decimal under 10", () => {
    expect(formatBytes(0, "en")).toBe("0 B");
    expect(formatBytes(1_500_000, "en")).toBe("1.5 MB");
    expect(formatBytes(42_300_000, "en")).toBe("42 MB");
    expect(formatBytes(2_000_000_000, "en")).toBe("2 GB");
  });
});

describe("groupMissingBySong", () => {
  const snapshot = {
    songsById: { a: { id: "a", title: "Song A" } },
    sheetMusicBySongId: { a: [{ id: "x", name: "Lead" }] },
  } as unknown as Pick<OfflineSnapshot, "songsById" | "sheetMusicBySongId">;
  const missing: OfflineMissingFile[] = [
    { storagePath: "1/a/x.pdf", sheetMusicId: "x", songId: "a", reason: "quota", bytes: 40_000_000 },
    { storagePath: "1/b/y.pdf", sheetMusicId: "y", songId: "b", reason: "network", bytes: null },
    { storagePath: "1/a/w.pdf", sheetMusicId: "w", songId: "a", reason: "not-found", bytes: null },
  ];

  it("groups by song in report order, with labels from the snapshot", () => {
    const groups = groupMissingBySong(missing, snapshot);
    expect(groups.map((g) => [g.songTitle, g.files.map((f) => [f.name, f.reason])])).toEqual([
      ["Song A", [["Lead", "quota"], [null, "not-found"]]],
      [null, [[null, "network"]]],
    ]);
  });

  it("works without a snapshot (generic labels)", () => {
    expect(groupMissingBySong(missing, null).every((g) => g.songTitle === null)).toBe(true);
  });
});

describe("copy exists in both locales", () => {
  const reasons: OfflineMissingFile["reason"][] = ["quota", "network", "not-found", "forbidden", "unknown", "not-downloaded"];
  it.each([["en", en], ["es", es]])("%s has every failure and reason key", (_name, locale) => {
    for (const code of FAILURE_CODES) expect(typeof lookup(locale, failureMessageKey(code))).toBe("string");
    for (const reason of reasons) expect(typeof lookup(locale, reasonKey(reason))).toBe("string");
    expect(typeof lookup(locale, "offline.failure.downloadInProgressElsewhere")).toBe("string");
  });

  it("en and es have the same offline keys", () => {
    const flat = (o: unknown, prefix = ""): string[] =>
      Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
        typeof v === "object" && v ? flat(v, `${prefix}${k}.`) : [`${prefix}${k}`]
      );
    expect(flat(es.offline).sort()).toEqual(flat(en.offline).sort());
  });

  it("an unknown code falls back to the generic message", () => {
    expect(failureMessageKey(null)).toBe("offline.failure.unknown");
  });
});
