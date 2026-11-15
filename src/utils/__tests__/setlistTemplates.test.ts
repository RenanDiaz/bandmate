import { describe, expect, it } from "vitest";
import { SETLIST_TEMPLATES, TEMPLATE_BREAK_MINUTES, templateItems } from "../setlistTemplates";

const t = (key: string, options?: Record<string, unknown>) =>
  options?.number !== undefined ? `${key}#${options.number}` : key;

describe("templateItems", () => {
  it("single-set is one section", () => {
    expect(templateItems("single-set", t)).toMatchObject([
      { type: "section", label: "setlists.templates.singleSetLabel", position: 0 },
    ]);
  });

  it("two-sets-break is Set 1, a 15-minute break, Set 2", () => {
    expect(templateItems("two-sets-break", t)).toMatchObject([
      { type: "section", label: "setlists.templates.set#1", position: 0 },
      { type: "break", label: "setlists.templates.break", duration: TEMPLATE_BREAK_MINUTES, position: 1 },
      { type: "section", label: "setlists.templates.set#2", position: 2 },
    ]);
  });

  it("two-sets-encore adds an Encore section", () => {
    const items = templateItems("two-sets-encore", t);
    expect(items).toHaveLength(4);
    expect(items[3]).toMatchObject({ type: "section", label: "setlists.templates.encore", position: 3 });
  });

  it("gives every item its own id, new on each call", () => {
    for (const id of SETLIST_TEMPLATES) {
      const first = templateItems(id, t).map((item) => item.id);
      const second = templateItems(id, t).map((item) => item.id);
      expect(first.every(Boolean)).toBe(true);
      expect(new Set(first).size).toBe(first.length);
      expect(first.some((itemId, index) => itemId === second[index])).toBe(false);
    }
  });
});
