import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { createTestI18n } from "../../../test/i18n";
import { ReorderToolbar, type ReorderToolbarProps } from "../ReorderToolbar";

const i18n = createTestI18n();
const html = (el: ReactElement) => renderToStaticMarkup(<I18nextProvider i18n={i18n}>{el}</I18nextProvider>);
const text = (el: ReactElement) => html(el).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const props = (overrides: Partial<ReorderToolbarProps> = {}): ReorderToolbarProps => ({
  canOptimize: true,
  saving: false,
  optimizing: false,
  onCancel: vi.fn(),
  onOptimize: vi.fn(),
  onSave: vi.fn(),
  ...overrides,
});

describe("ReorderToolbar (spec §2.4)", () => {
  it("shows the hint, Cancel, Optimize and Save", () => {
    const t = text(<ReorderToolbar {...props()} />);
    expect(t).toContain("Drag songs to reorder");
    expect(t).toContain("Cancel");
    expect(t).toContain("Optimize Order");
    expect(t).toContain("Save Order");
    expect(html(<ReorderToolbar {...props()} />)).not.toContain("disabled");
  });

  it("hides Optimize when it is not available", () => {
    expect(text(<ReorderToolbar {...props({ canOptimize: false })} />)).not.toContain("Optimize");
  });

  it("saving shows the saving label and disables all three", () => {
    const out = html(<ReorderToolbar {...props({ saving: true })} />);
    expect(out).toContain("Saving...");
    expect(out).not.toContain("<span>Save Order</span>");
    expect(out.match(/<button[^>]*disabled/g)).toHaveLength(3);
  });

  it("optimizing disables all three as well", () => {
    expect(html(<ReorderToolbar {...props({ optimizing: true })} />).match(/<button[^>]*disabled/g)).toHaveLength(3);
  });
});
