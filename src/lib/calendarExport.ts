import type { Show } from "../services/showsService";
import type { Rehearsal } from "../services/rehearsalsService";
import {
  buildIcsCalendar,
  DEFAULT_ICS_LABELS,
  rehearsalToIcsEvent,
  showToIcsEvent,
} from "../../supabase/functions/_shared/ics";
import type { IcsEvent, IcsLabels } from "../../supabase/functions/_shared/ics";

/**
 * Single-event iCalendar (.ics) downloads. Compatible with Google Calendar,
 * Apple Calendar, Outlook, etc. The builder is shared with the calendar-feed
 * Edge Function, so a downloaded event and the subscribed one have the same
 * UID: a calendar that has both keeps one copy.
 */

/** Localized labels for event descriptions. */
export function buildIcsLabels(t: (key: string) => string): IcsLabels {
  return {
    soundcheck: t("shows.soundcheck"),
    doors: t("shows.doors"),
    rehearsal: t("rehearsals.rehearsal"),
    formatTime: DEFAULT_ICS_LABELS.formatTime,
  };
}

function appOrigin(): string | undefined {
  return typeof window === "undefined" ? undefined : window.location.origin;
}

export function generateShowICS(
  show: Show,
  labels: IcsLabels = DEFAULT_ICS_LABELS
): string {
  return buildIcsCalendar({
    prodId: "-//Bandmate//Show//EN",
    events: [showToIcsEvent(show, labels, appOrigin())],
  });
}

export function generateRehearsalICS(
  rehearsal: Rehearsal,
  labels: IcsLabels = DEFAULT_ICS_LABELS
): string {
  return buildIcsCalendar({
    prodId: "-//Bandmate//Rehearsal//EN",
    events: [rehearsalToIcsEvent(rehearsal, labels, appOrigin())],
  });
}

function fileName(event: Pick<IcsEvent, "summary">): string {
  const base = event.summary
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return `${base || "event"}.ics`;
}

function download(icsContent: string, name: string): void {
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadShowICS(show: Show, labels?: IcsLabels): void {
  download(generateShowICS(show, labels), fileName({ summary: show.name }));
}

export function downloadRehearsalICS(
  rehearsal: Rehearsal,
  labels?: IcsLabels
): void {
  const event = rehearsalToIcsEvent(rehearsal, labels ?? DEFAULT_ICS_LABELS);
  download(generateRehearsalICS(rehearsal, labels), fileName(event));
}
