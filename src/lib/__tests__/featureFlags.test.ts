import { describe, expect, it } from "vitest";
import { PUSH_FLAG_STORAGE_KEY, applyFlagParams, isPushNotificationsEnabled } from "../featureFlags";

describe("isPushNotificationsEnabled", () => {
  it("is off by default", () => {
    localStorage.clear();
    expect(isPushNotificationsEnabled()).toBe(false);
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

  it("?flag=push turns the push flag on and drops only that param", () => {
    localStorage.clear();
    expect(applyFlagParams(`${origin}/setlists?band=7&flag=push#x`, localStorage)).toBe("/setlists?band=7#x");
    expect(localStorage.getItem(PUSH_FLAG_STORAGE_KEY)).toBe("1");
    expect(isPushNotificationsEnabled()).toBe(true);
    localStorage.clear();
  });

  it("-name removes the override; commas and repeated params combine", () => {
    localStorage.clear();
    expect(applyFlagParams(`${origin}/?flag=push,push`, localStorage)).toBe("/");
    expect(localStorage.getItem(PUSH_FLAG_STORAGE_KEY)).toBe("1");
    expect(applyFlagParams(`${origin}/?flag=other&flag=-push`, localStorage)).toBe("/");
    expect(localStorage.getItem(PUSH_FLAG_STORAGE_KEY)).toBeNull();
  });

  it("ignores unknown names (the removed offline flag too) but still cleans the URL", () => {
    localStorage.clear();
    expect(applyFlagParams(`${origin}/?flag=offline`, localStorage)).toBe("/");
    expect(applyFlagParams(`${origin}/?flag=everything`, localStorage)).toBe("/");
    expect(localStorage.length).toBe(0);
  });

  it("storage that throws or is missing keeps the flag off without failing", () => {
    const throwing = { setItem: () => { throw new Error("SecurityError"); }, removeItem: () => {} };
    expect(applyFlagParams(`${origin}/?flag=push`, throwing)).toBe("/");
    expect(applyFlagParams(`${origin}/?flag=push`, null)).toBe("/");
  });
});
