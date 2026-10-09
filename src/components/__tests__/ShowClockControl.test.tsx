import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { ShowClockControl } from "../ShowClockControl";
import type { ShowClock } from "../../lib/showClock";
import { createTestI18n } from "../../test/i18n";

const i18n = createTestI18n();
const noop = () => {};

function render(status: ShowClock["status"], elapsedMs: number, autoStartArmed = false) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <ShowClockControl
        status={status}
        elapsedMs={elapsedMs}
        autoStartArmed={autoStartArmed}
        onStart={noop}
        onPause={noop}
        onReset={noop}
      />
    </I18nextProvider>
  );
}

const labels = (html: string) => [...html.matchAll(/<button[^>]*aria-label="([^"]+)"/g)].map(([, label]) => label);

describe("ShowClockControl (show-clock spec)", () => {
  it("idle: one start button at 0:00, with the auto-start hint only when armed", () => {
    const html = render("idle", 0);
    expect(labels(html)).toEqual(["Start show clock"]);
    expect(html).toContain("0:00");
    expect(html).not.toContain("show-clock-auto");
    expect(render("idle", 0, true)).toContain("show-clock-auto");
  });

  it("running: the time and Stop", () => {
    const html = render("running", 5_025_000);
    expect(html).toContain("1:23:45");
    expect(labels(html)).toEqual(["Stop show clock"]);
  });

  it("stopped: the frozen time, Resume and Reset", () => {
    const html = render("paused", 754_000);
    expect(html).toContain("12:34");
    expect(labels(html)).toEqual(["Resume show clock", "Reset show clock"]);
  });
});
