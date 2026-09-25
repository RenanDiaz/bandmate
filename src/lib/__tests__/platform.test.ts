import { describe, expect, it } from "vitest";
import { isIOS, isStandalone } from "../platform";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";
const IPADOS = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0 Mobile Safari/537.36";

const media = (standalone: boolean) => () => ({ matches: standalone });

describe("platform (§9.1)", () => {
  it("iPhone in a Safari tab: iOS, not standalone (install hint shows)", () => {
    const env = { userAgent: IPHONE_SAFARI, platform: "iPhone", maxTouchPoints: 5, matchMedia: media(false) };
    expect(isIOS(env)).toBe(true);
    expect(isStandalone(env)).toBe(false);
  });

  it("iPhone installed app: standalone by display-mode or navigator.standalone", () => {
    expect(isStandalone({ userAgent: IPHONE_SAFARI, matchMedia: media(true) })).toBe(true);
    expect(isStandalone({ userAgent: IPHONE_SAFARI, standalone: true })).toBe(true);
  });

  it("iPadOS reports a Mac with touch", () => {
    expect(isIOS({ userAgent: IPADOS, platform: "MacIntel", maxTouchPoints: 5 })).toBe(true);
    expect(isIOS({ userAgent: IPADOS, platform: "MacIntel", maxTouchPoints: 0 })).toBe(false);
  });

  it("Android is not iOS", () => {
    expect(isIOS({ userAgent: ANDROID, platform: "Linux armv8l", maxTouchPoints: 5 })).toBe(false);
  });

  it("no environment: not iOS, not standalone", () => {
    expect(isIOS({})).toBe(false);
    expect(isStandalone({})).toBe(false);
  });
});
