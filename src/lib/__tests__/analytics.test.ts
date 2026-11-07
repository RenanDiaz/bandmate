// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { ANALYTICS_SCRIPT_SRC, installAnalytics, sanitizeAnalyticsEvent } from "../analytics";

describe("sanitizeAnalyticsEvent", () => {
  it("drops the query string and hash", () => {
    expect(
      sanitizeAnalyticsEvent({
        type: "pageview",
        url: "https://www.bandmate.space/invite/accept?token=secret#x",
      }),
    ).toEqual({ type: "pageview", url: "https://www.bandmate.space/invite/accept" });
  });

  it("keeps the path", () => {
    expect(
      sanitizeAnalyticsEvent({ type: "pageview", url: "https://www.bandmate.space/setlists/12?song=4" }),
    ).toEqual({ type: "pageview", url: "https://www.bandmate.space/setlists/12" });
  });

  it("drops an event whose url doesn't parse", () => {
    expect(sanitizeAnalyticsEvent({ type: "pageview", url: "not a url" })).toBeNull();
  });
});

describe("installAnalytics", () => {
  afterEach(() => {
    document.head.innerHTML = "";
    delete window.va;
    delete window.vaq;
    Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
  });

  const scripts = () => document.head.querySelectorAll(`script[src="${ANALYTICS_SCRIPT_SRC}"]`);

  it("adds the script once and queues the beforeSend hook", () => {
    installAnalytics();
    installAnalytics();
    expect(scripts()).toHaveLength(1);
    expect(window.vaq).toEqual([["beforeSend", sanitizeAnalyticsEvent]]);
  });

  it("does nothing offline", () => {
    Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
    installAnalytics();
    expect(scripts()).toHaveLength(0);
    expect(window.va).toBeUndefined();
  });
});
