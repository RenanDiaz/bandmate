/**
 * iCalendar (RFC 5545) builder shared by the `calendar-feed` Edge Function
 * (Deno) and the app's single-event `.ics` download (`src/lib/calendarExport.ts`).
 *
 * Keep this file dependency-free and runtime-neutral: no imports, no Deno or
 * DOM APIs. It is unit-tested from `src/lib/__tests__/ics.test.ts`.
 *
 * Times are "floating" (no TZID): the app stores wall-clock times without a
 * zone, and a floating time means "this time wherever the calendar is". The
 * feed adds `X-WR-TIMEZONE` so Google Calendar, which otherwise may read
 * floating times as UTC, places them in the subscriber's zone.
 */

export type IcsStatus = "CONFIRMED" | "CANCELLED" | "TENTATIVE";

export interface IcsEvent {
  uid: string;
  summary: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM" or "HH:MM:SS"; omitted → all-day event */
  startTime?: string | null;
  /** "HH:MM" or "HH:MM:SS"; earlier than or equal to start → next day */
  endTime?: string | null;
  /** Used when there is a start time but no end time */
  defaultDurationMinutes?: number;
  location?: string | null;
  description?: string | null;
  status?: IcsStatus;
  /** ISO timestamp of the last change (row `updated_at`) */
  lastModified?: string | null;
  url?: string | null;
}

export interface IcsCalendar {
  prodId: string;
  name?: string;
  description?: string;
  /** IANA zone name, e.g. "America/Panama" */
  timezone?: string | null;
  /** Suggested refresh interval for subscribed feeds, in hours */
  refreshHours?: number;
  events: IcsEvent[];
}

const DEFAULT_DURATION_MINUTES = 120;
const MINUTES_PER_DAY = 24 * 60;

export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Folds a content line to at most 75 octets per physical line (RFC 5545
 * §3.1), never splitting a UTF-8 sequence.
 */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  // The first line holds 75 octets; continuation lines start with a space.
  let limit = 75;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (currentBytes + bytes > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
      limit = 74;
    }
    current += char;
    currentBytes += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const pad = (n: number) => n.toString().padStart(2, "0");

/** "YYYY-MM-DD" + n days, computed in UTC so DST never shifts the date. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const result = new Date(Date.UTC(y, m - 1, d + days));
  return `${result.getUTCFullYear()}-${pad(result.getUTCMonth() + 1)}-${pad(
    result.getUTCDate()
  )}`;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

function formatDate(date: string): string {
  return date.replace(/-/g, "");
}

function formatDateTime(date: string, minutes: number): string {
  return `${formatDate(date)}T${pad(Math.floor(minutes / 60))}${pad(
    minutes % 60
  )}00`;
}

export function formatUtcStamp(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(
    date.getUTCDate()
  )}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(
    date.getUTCSeconds()
  )}Z`;
}

/** Start/end properties for an event, handling all-day and past-midnight ends. */
export function eventTimeLines(event: IcsEvent): string[] {
  if (!event.startTime) {
    return [
      `DTSTART;VALUE=DATE:${formatDate(event.date)}`,
      `DTEND;VALUE=DATE:${formatDate(addDays(event.date, 1))}`,
    ];
  }

  const start = toMinutes(event.startTime);
  let end = event.endTime
    ? toMinutes(event.endTime)
    : start + (event.defaultDurationMinutes ?? DEFAULT_DURATION_MINUTES);
  // An end at or before the start (e.g. 22:00–01:00) finishes the next day.
  if (end <= start) end += MINUTES_PER_DAY;

  const endDate = addDays(event.date, Math.floor(end / MINUTES_PER_DAY));
  return [
    `DTSTART:${formatDateTime(event.date, start)}`,
    `DTEND:${formatDateTime(endDate, end % MINUTES_PER_DAY)}`,
  ];
}

export function buildIcsEventLines(event: IcsEvent, stamp: string): string[] {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${stamp}`,
    ...eventTimeLines(event),
    `SUMMARY:${escapeIcsText(event.summary)}`,
  ];

  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  }
  if (event.url) lines.push(`URL:${event.url}`);
  if (event.lastModified) {
    const modified = new Date(event.lastModified);
    if (!Number.isNaN(modified.getTime())) {
      lines.push(`LAST-MODIFIED:${formatUtcStamp(modified)}`);
    }
  }
  lines.push(`STATUS:${event.status ?? "CONFIRMED"}`, "END:VEVENT");
  return lines;
}

export function buildIcsCalendar(
  calendar: IcsCalendar,
  now: Date = new Date()
): string {
  const stamp = formatUtcStamp(now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${calendar.prodId}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  if (calendar.name) lines.push(`X-WR-CALNAME:${escapeIcsText(calendar.name)}`);
  if (calendar.description) {
    lines.push(`X-WR-CALDESC:${escapeIcsText(calendar.description)}`);
  }
  if (calendar.timezone) lines.push(`X-WR-TIMEZONE:${calendar.timezone}`);
  if (calendar.refreshHours) {
    lines.push(
      `X-PUBLISHED-TTL:PT${calendar.refreshHours}H`,
      `REFRESH-INTERVAL;VALUE=DURATION:PT${calendar.refreshHours}H`
    );
  }

  for (const event of calendar.events) {
    lines.push(...buildIcsEventLines(event, stamp));
  }
  lines.push("END:VCALENDAR");

  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

/* ---------- Bandmate rows → events ---------- */

export interface IcsShowRow {
  id: string;
  name: string;
  venue?: string | null;
  venue_address?: string | null;
  event_date: string;
  event_time?: string | null;
  doors_time?: string | null;
  soundcheck_time?: string | null;
  status: string;
  notes?: string | null;
  updated_at?: string | null;
}

export interface IcsRehearsalRow {
  id: string;
  name?: string | null;
  location?: string | null;
  rehearsal_date: string;
  start_time?: string | null;
  end_time?: string | null;
  status: string;
  notes?: string | null;
  updated_at?: string | null;
}

export interface IcsLabels {
  soundcheck: string;
  doors: string;
  rehearsal: string;
  /** Formats a stored "HH:MM[:SS]" time for descriptions */
  formatTime: (time: string) => string;
}

export const DEFAULT_ICS_LABELS: IcsLabels = {
  soundcheck: "Soundcheck",
  doors: "Doors",
  rehearsal: "Rehearsal",
  formatTime: (time) => time.slice(0, 5),
};

export function showToIcsEvent(
  show: IcsShowRow,
  labels: IcsLabels = DEFAULT_ICS_LABELS,
  appUrl?: string
): IcsEvent {
  const description = [
    show.soundcheck_time &&
      `${labels.soundcheck}: ${labels.formatTime(show.soundcheck_time)}`,
    show.doors_time && `${labels.doors}: ${labels.formatTime(show.doors_time)}`,
    show.notes,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    uid: `show-${show.id}@bandmate`,
    summary: show.name,
    date: show.event_date,
    startTime: show.event_time,
    location: [show.venue, show.venue_address].filter(Boolean).join(", "),
    description,
    status: show.status === "cancelled" ? "CANCELLED" : "CONFIRMED",
    lastModified: show.updated_at,
    url: appUrl ? `${appUrl}/shows/${show.id}` : null,
  };
}

const SOUNDCHECK_DEFAULT_DURATION_MINUTES = 60;

/**
 * The soundcheck as its own event (a call time the musician gets a reminder
 * for), or `null` when the show has none. It ends at doors, else at show time,
 * else after an hour; a soundcheck stored after both keeps the hour. The UID
 * derives from the show's so a download and the feed dedupe the same way.
 */
export function soundcheckToIcsEvent(
  show: IcsShowRow,
  labels: IcsLabels = DEFAULT_ICS_LABELS,
  appUrl?: string
): IcsEvent | null {
  if (!show.soundcheck_time) return null;

  const start = toMinutes(show.soundcheck_time);
  const endTime = [show.doors_time, show.event_time].find(
    (time): time is string => !!time && toMinutes(time) > start
  );

  return {
    uid: `show-${show.id}-soundcheck@bandmate`,
    summary: `${labels.soundcheck}: ${show.name}`,
    date: show.event_date,
    startTime: show.soundcheck_time,
    endTime,
    defaultDurationMinutes: SOUNDCHECK_DEFAULT_DURATION_MINUTES,
    location: [show.venue, show.venue_address].filter(Boolean).join(", "),
    description: show.notes,
    status: show.status === "cancelled" ? "CANCELLED" : "CONFIRMED",
    lastModified: show.updated_at,
    url: appUrl ? `${appUrl}/shows/${show.id}` : null,
  };
}

/** Every event a show contributes to a calendar: the show, then its soundcheck. */
export function showToIcsEvents(
  show: IcsShowRow,
  labels: IcsLabels = DEFAULT_ICS_LABELS,
  appUrl?: string
): IcsEvent[] {
  const soundcheck = soundcheckToIcsEvent(show, labels, appUrl);
  return soundcheck
    ? [showToIcsEvent(show, labels, appUrl), soundcheck]
    : [showToIcsEvent(show, labels, appUrl)];
}

export function rehearsalToIcsEvent(
  rehearsal: IcsRehearsalRow,
  labels: IcsLabels = DEFAULT_ICS_LABELS,
  appUrl?: string
): IcsEvent {
  return {
    uid: `rehearsal-${rehearsal.id}@bandmate`,
    summary: rehearsal.name
      ? `${labels.rehearsal}: ${rehearsal.name}`
      : labels.rehearsal,
    date: rehearsal.rehearsal_date,
    startTime: rehearsal.start_time,
    endTime: rehearsal.end_time,
    location: rehearsal.location,
    description: rehearsal.notes,
    status: rehearsal.status === "cancelled" ? "CANCELLED" : "CONFIRMED",
    lastModified: rehearsal.updated_at,
    url: appUrl ? `${appUrl}/rehearsals/${rehearsal.id}` : null,
  };
}
