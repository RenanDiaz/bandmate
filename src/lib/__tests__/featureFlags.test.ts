import { describe, expect, it } from "vitest";
import {
  OFFLINE_FLAG_STORAGE_KEY,
  PUSH_FLAG_STORAGE_KEY,
  applyFlagParams,
  isOfflineDownloadsEnabled,
  isPushNotificationsEnabled,
} from "../featureFlags";

const storage = (value: string | null) => ({ getItem: (key: string) => (key === OFFLINE_FLAG_STORAGE_KEY ? value : null) });

describe("isOfflineDownloadsEnabled", () => {
  it("is off by default", () => {
    expect(isOfflineDownloadsEnabled({ envValue: undefined, storage: storage(null) })).toBe(false);
    // The real environment: no VITE_OFFLINE_DOWNLOADS in tests, empty localStorage.
    localStorage.clear();
    expect(isOfflineDownloadsEnabled()).toBe(false);
  });

  it("VITE_OFFLINE_DOWNLOADS=true turns it on", () => {
    expect(isOfflineDownloadsEnabled({ envValue: "true", storage: null })).toBe(true);
    expect(isOfflineDownloadsEnabled({ envValue: "1", storage: null })).toBe(false);
  });

  it("the per-device override needs exactly \"1\"", () => {
    expect(isOfflineDownloadsEnabled({ storage: storage("1") })).toBe(true);
    expect(isOfflineDownloadsEnabled({ storage: storage("true") })).toBe(false);
    localStorage.setItem(OFFLINE_FLAG_STORAGE_KEY, "1");
    expect(isOfflineDownloadsEnabled()).toBe(true);
    localStorage.clear();
  });

  it("storage that throws counts as off", () => {
    const throwing = { getItem: () => { throw new Error("SecurityError"); } };
    expect(isOfflineDownloadsEnabled({ storage: throwing })).toBe(false);
  });
});

describe("isPushNotificationsEnabled", () => {
  it("is off by default and independent of the offline flag", () => {
    localStorage.clear();
    expect(isPushNotificationsEnabled()).toBe(false);
    localStorage.setItem(OFFLINE_FLAG_STORAGE_KEY, "1");
    expect(isPushNotificationsEnabled()).toBe(false);
    localStorage.clear();
  });

  it("turns on with VITE_PUSH_NOTIFICATIONS=true or the per-device \"1\"", () => {
    expect(isPushNotificationsEnabled({ envValue: "true", storage: null })).toBe(true);
    localStorage.setItem(PUSH_FLAG_STORAGE_KEY, "1");
    expect(isPushNotificationsEnabled()).toBe(true);
    localStorage.setItem(PUSH_FLAG_STORAGE_KEY, "true");
    expect(isPushNotificationsEnabled()).toBe(false);
    localStorage.clear();
  });
});

describe("applyFlagParams", () => {
  const origin = "https://www.bandmate.space";

  it("returns null and touches nothing without a flag param", () => {
    localStorage.clear();
    expect(applyFlagParams(`${origin}/setlists?band=7`, localStorage)).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("?flag=offline turns the offline flag on and drops only that param", () => {
    localStorage.clear();
    expect(applyFlagParams(`${origin}/setlists?band=7&flag=offline#x`, localStorage)).toBe("/setlists?band=7#x");
    expect(localStorage.getItem(OFFLINE_FLAG_STORAGE_KEY)).toBe("1");
    expect(isOfflineDownloadsEnabled()).toBe(true);
    localStorage.clear();
  });

  it("-name removes the override; commas and repeated params combine", () => {
    localStorage.clear();
    expect(applyFlagParams(`${origin}/?flag=offline,push`, localStorage)).toBe("/");
    expect(localStorage.getItem(PUSH_FLAG_STORAGE_KEY)).toBe("1");
    expect(applyFlagParams(`${origin}/?flag=-offline&flag=-push`, localStorage)).toBe("/");
    expect(localStorage.getItem(OFFLINE_FLAG_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(PUSH_FLAG_STORAGE_KEY)).toBeNull();
  });

  it("ignores unknown names but still cleans the URL", () => {
    localStorage.clear();
    expect(applyFlagParams(`${origin}/?flag=everything`, localStorage)).toBe("/");
    expect(localStorage.length).toBe(0);
  });

  it("storage that throws or is missing keeps the flag off without failing", () => {
    const throwing = { setItem: () => { throw new Error("SecurityError"); }, removeItem: () => {} };
    expect(applyFlagParams(`${origin}/?flag=offline`, throwing)).toBe("/");
    expect(applyFlagParams(`${origin}/?flag=offline`, null)).toBe("/");
  });
});
