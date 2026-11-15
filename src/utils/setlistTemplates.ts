import { generateSetlistItemId, type SetlistItem } from "../services/setlistsService";

/**
 * Structure templates for a new setlist (docs/specs/setlist-builder.md §4.2).
 * A template is plain items — sections and a break — so nothing downstream
 * knows templates exist. Labels are localised once, at creation; after that
 * they are the band's text.
 */

export type SetlistTemplateId = "single-set" | "two-sets-break" | "two-sets-encore";

export const SETLIST_TEMPLATES: readonly SetlistTemplateId[] = ["single-set", "two-sets-break", "two-sets-encore"];

export type Translate = (key: string, options?: Record<string, unknown>) => string;

const T = "setlists.templates";

export const TEMPLATE_BREAK_MINUTES = 15;

export function templateItems(id: SetlistTemplateId, t: Translate): SetlistItem[] {
  const section = (label: string): SetlistItem => ({ type: "section", id: generateSetlistItemId(), label, position: 0 });
  const twoSets = (): SetlistItem[] => [
    section(t(`${T}.set`, { number: 1 })),
    {
      type: "break",
      id: generateSetlistItemId(),
      label: t(`${T}.break`),
      duration: TEMPLATE_BREAK_MINUTES,
      position: 0,
    },
    section(t(`${T}.set`, { number: 2 })),
  ];

  const items =
    id === "single-set"
      ? [section(t(`${T}.singleSetLabel`))]
      : id === "two-sets-break"
        ? twoSets()
        : [...twoSets(), section(t(`${T}.encore`))];

  return items.map((item, position) => ({ ...item, position }));
}
