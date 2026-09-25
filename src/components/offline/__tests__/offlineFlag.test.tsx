import { beforeEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OFFLINE_FLAG_STORAGE_KEY } from "../../../lib/featureFlags";
import { OfflineDownloadAction, OfflineStatusRow } from "../OfflineDownloadAction";

// No providers on purpose: with the flag off nothing below the check may run.
describe("offline downloads behind the flag (off by default)", () => {
  beforeEach(() => localStorage.removeItem(OFFLINE_FLAG_STORAGE_KEY));

  it.each(["setlist", "show", "toolbar"] as const)("the %s action is not rendered", (variant) => {
    expect(renderToStaticMarkup(<OfflineDownloadAction setlistId="s1" setlistName="Friday" variant={variant} />)).toBe("");
  });

  it("the status row (badge, Remove, interrupted notice) is not rendered", () => {
    expect(renderToStaticMarkup(<OfflineStatusRow setlistId="s1" setlistName="Friday" />)).toBe("");
  });

  it("the per-device override renders it (and then needs the app's providers)", () => {
    localStorage.setItem(OFFLINE_FLAG_STORAGE_KEY, "1");
    expect(() => renderToStaticMarkup(<OfflineStatusRow setlistId="s1" setlistName="Friday" />)).toThrow();
  });
});
