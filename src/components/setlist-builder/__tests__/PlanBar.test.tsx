import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { createTestI18n } from "../../../test/i18n";
import { PlanBar } from "../PlanBar";
import type { PlanProgress } from "../../../utils/setlistPlan";

const i18n = createTestI18n();

function render(progress: PlanProgress, targetMinutes: number | null, readOnly = false) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <PlanBar progress={progress} targetMinutes={targetMinutes} onTargetChange={() => {}} readOnly={readOnly} />
    </I18nextProvider>
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("PlanBar", () => {
  it("without a target: totals and an empty input, no progress", () => {
    const html = render({ songCount: 12, musicSeconds: 2900, totalSeconds: 3500 }, null);
    expect(text(html)).toContain("12 songs");
    expect(text(html)).toContain("48:20 of music");
    expect(text(html)).toContain("58:20 with breaks");
    expect(html).toContain('type="number"');
    expect(html).not.toContain('role="progressbar"');
  });

  it("under the target (AC7): 58:20 against 60 reads 58 / 60", () => {
    const html = render(
      { songCount: 12, musicSeconds: 2900, totalSeconds: 3500, targetSeconds: 3600, ratio: 3500 / 3600 },
      60
    );
    expect(text(html)).toContain("58 / 60");
    expect(html).toContain('data-over="false"');
    expect(html).toContain('aria-valuenow="58"');
  });

  it("over the target (AC7): 63:20 against 60 reads 63 / 60 (+3) and is marked over", () => {
    const html = render(
      { songCount: 13, musicSeconds: 3200, totalSeconds: 3800, targetSeconds: 3600, ratio: 3800 / 3600, overBySeconds: 200 },
      60
    );
    expect(text(html)).toContain("63 / 60 (+3)");
    expect(html).toContain('data-over="true"');
  });

  it("hides the 'with breaks' total when there are no breaks", () => {
    expect(text(render({ songCount: 2, musicSeconds: 400, totalSeconds: 400 }, null))).not.toContain("with breaks");
  });

  it("read-only: no input; without a target nothing about the target", () => {
    const withTarget = render(
      { songCount: 2, musicSeconds: 400, totalSeconds: 400, targetSeconds: 600, ratio: 400 / 600 },
      10,
      true
    );
    expect(withTarget).not.toContain("<input");
    expect(text(withTarget)).toContain("Target");
    expect(text(withTarget)).toContain("6 / 10");

    const withoutTarget = render({ songCount: 2, musicSeconds: 400, totalSeconds: 400 }, null, true);
    expect(text(withoutTarget)).not.toContain("Target");
  });
});
