// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import type { Show } from "../../../services/showsService";
import type { Rehearsal } from "../../../services/rehearsalsService";
import { mergeUpcomingEvents } from "../../../utils/upcomingEvents";
import { createTestI18n } from "../../../test/i18n";
import { BAND_COLORS } from "../../../utils/bandColors";
import { SOON_DAYS, UpcomingEventRow } from "../UpcomingEventRow";

const i18n = createTestI18n();

function show(event_date: string, extra: Partial<Show> = {}): Show {
  return {
    id: "s1",
    band_id: 1,
    user_id: "u",
    name: "The Cavern gig",
    event_date,
    status: "upcoming",
    created_at: "",
    updated_at: "",
    ...extra,
  };
}

function rehearsal(rehearsal_date: string, extra: Partial<Rehearsal> = {}): Rehearsal {
  return {
    id: "r1",
    band_id: 1,
    user_id: "u",
    name: "Pre-show run",
    rehearsal_date,
    status: "scheduled",
    created_at: "",
    updated_at: "",
    ...extra,
  };
}

function renderRow(props: Partial<Parameters<typeof UpcomingEventRow>[0]> & { event: Parameters<typeof UpcomingEventRow>[0]["event"] }) {
  const html = renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <UpcomingEventRow locale="en-US" onOpen={() => {}} {...props} />
    </I18nextProvider>
  );
  const doc = new DOMParser().parseFromString(html, "text/html");
  const text = (selector: string) => doc.querySelector(selector)?.textContent?.trim() ?? null;
  /** The texts of an element's children (the meta line's separators are CSS, so textContent runs them together). */
  const parts = (selector: string) =>
    [...(doc.querySelector(selector)?.children ?? [])].map((child) => child.textContent?.trim() ?? "");
  return { doc, text, parts };
}

const showEvent = (event_date: string, extra: Partial<Show> = {}) =>
  mergeUpcomingEvents([show(event_date, extra)], [])[0];
const rehearsalEvent = (rehearsal_date: string, extra: Partial<Rehearsal> = {}) =>
  mergeUpcomingEvents([], [rehearsal(rehearsal_date, extra)])[0];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-01T12:00:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("UpcomingEventRow (my-upcoming-events AC11)", () => {
  it("date block: weekday, day and month; the meta line repeats no date", () => {
    const { text, parts } = renderRow({ event: showEvent("2026-10-03", { venue: "The Cavern", event_time: "21:00" }) });
    expect(parts("[data-testid=event-date]")).toEqual(["Sat", "3", "Oct"]);
    expect(text("[data-testid=event-meta]")).not.toMatch(/Oct|Sat/);
  });

  it("meta line: band, type, place, time, countdown, in that order", () => {
    const { parts } = renderRow({
      event: showEvent("2026-10-03", { venue: "The Cavern", event_time: "21:00" }),
      bandName: "Los Rockers",
    });
    // The chip's text is the avatar initial plus the name.
    expect(parts("[data-testid=event-meta]")).toEqual(["LLos Rockers", "Show", "The Cavern", "9:00 PM", "In 2 days"]);
  });

  it("a rehearsal reads Rehearsal and its location", () => {
    const { parts } = renderRow({ event: rehearsalEvent("2026-10-05", { location: "Studio B" }) });
    expect(parts("[data-testid=event-meta]")).toEqual(["Rehearsal", "Studio B", "In 4 days"]);
  });

  it(`countdown within ${SOON_DAYS} days is marked soon; a later one is not`, () => {
    const soon = renderRow({ event: showEvent("2026-10-08") });
    expect(soon.text("[data-testid=event-countdown]")).toBe("In 7 days");
    expect(soon.doc.querySelector("[data-testid=event-countdown]")?.getAttribute("data-soon")).toBe("true");

    const later = renderRow({ event: showEvent("2026-10-09") });
    expect(later.text("[data-testid=event-countdown]")).toBe("In 1 week and 1 day");
    expect(later.doc.querySelector("[data-testid=event-countdown]")?.getAttribute("data-soon")).toBe("false");
  });

  it("without bandName there is no chip; without a place or time the meta line skips them", () => {
    const { doc, parts } = renderRow({ event: showEvent("2026-10-01") });
    expect(doc.querySelector("[title]")).toBeNull();
    expect(parts("[data-testid=event-meta]")).toEqual(["Show", "Today"]);
  });

  it("the Setlist chip renders only with onOpenLink and a setlist_id", () => {
    const withLink = renderRow({ event: showEvent("2026-10-03", { setlist_id: "l1" }), onOpenLink: () => {} });
    expect(withLink.text("button")).toBe("Setlist");
    const noHandler = renderRow({ event: showEvent("2026-10-03", { setlist_id: "l1" }) });
    expect(noHandler.doc.querySelector("button")).toBeNull();
  });

  it("the date block takes the band colour when given; otherwise none is set", () => {
    const colored = renderRow({ event: rehearsalEvent("2026-10-05"), bandColor: BAND_COLORS[2] });
    expect(colored.doc.querySelector("[data-testid=event-date]")?.getAttribute("data-band-color")).toBe("emerald");
    const plain = renderRow({ event: rehearsalEvent("2026-10-05") });
    expect(plain.doc.querySelector("[data-testid=event-date]")?.hasAttribute("data-band-color")).toBe(false);
  });
});
