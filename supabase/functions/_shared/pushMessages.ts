/**
 * Push notification texts, shared by the `send-push-notifications` Edge
 * Function (Deno). The service worker only displays what it receives and the
 * sender doesn't run i18next, so both languages live here, picked by the
 * subscription's `locale`.
 *
 * Keep this file dependency-free and runtime-neutral: no imports, no Deno or
 * DOM APIs. It is unit-tested from `src/lib/__tests__/pushMessages.test.ts`.
 *
 * Dates and times are the stored wall-clock strings ("YYYY-MM-DD",
 * "HH:MM[:SS]"), formatted by hand: never through `new Date("YYYY-MM-DD")`,
 * which reads a date-only string as UTC midnight.
 */

export type PushEventType =
  | "show.created"
  | "rehearsal.created"
  | "setlist.published";

export type PushLocale = "en" | "es";

/** What the service worker receives (JSON), and all it shows. */
export interface PushMessage {
  title: string;
  body: string;
  /** App path to open on tap, with `?band=<id>` so the app selects the band */
  url: string;
  /** Replaces an earlier notification about the same entity */
  tag: string;
}

export interface PushMessageInput {
  type: PushEventType;
  bandId: number;
  bandName: string;
  actorName: string;
  entityId: string;
  /** notification_events.payload, as written by the triggers */
  payload: Record<string, unknown>;
  locale: PushLocale;
}

const MAX_NAME = 80;

const WEEKDAYS: Record<PushLocale, string[]> = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  es: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"],
};

const MONTHS: Record<PushLocale, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"],
};

const TEXT = {
  en: {
    someone: "Someone",
    untitled: "Untitled",
    showTitle: "New show",
    rehearsalTitle: "New rehearsal",
    setlistTitle: "New setlist",
    added: (actor: string, name: string) => `${actor} added "${name}"`,
    addedRehearsal: (actor: string) => `${actor} added a rehearsal`,
    songs: (n: number) => (n === 1 ? "1 song" : `${n} songs`),
  },
  es: {
    someone: "Alguien",
    untitled: "Sin nombre",
    showTitle: "Nuevo show",
    rehearsalTitle: "Nuevo ensayo",
    setlistTitle: "Nuevo setlist",
    added: (actor: string, name: string) => `${actor} agregó "${name}"`,
    addedRehearsal: (actor: string) => `${actor} agregó un ensayo`,
    songs: (n: number) => (n === 1 ? "1 canción" : `${n} canciones`),
  },
} as const;

/** "es", "es-PA", "es_419" → "es"; anything else → "en". */
export function normalizePushLocale(value: unknown): PushLocale {
  return typeof value === "string" && value.toLowerCase().startsWith("es")
    ? "es"
    : "en";
}

/**
 * The name shown for the member who made the change: `full_name`, then
 * `name`, then the email's local part; null when there is none.
 */
export function actorDisplayName(
  metadata: Record<string, unknown> | null | undefined,
  email: string | null | undefined
): string | null {
  for (const key of ["full_name", "name"]) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const local = email?.split("@")[0]?.trim();
  return local ? local : null;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_NAME ? `${trimmed.slice(0, MAX_NAME - 1)}…` : trimmed;
}

/** "2026-10-10" → "Sat, Oct 10" / "sáb 10 oct"; null when unparseable. */
export function formatPushDate(value: unknown, locale: PushLocale): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Explicit UTC parts: the weekday of that calendar date, whatever the zone.
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const w = WEEKDAYS[locale][weekday];
  const m = MONTHS[locale][month - 1];
  return locale === "es" ? `${w} ${day} ${m}` : `${w}, ${m} ${day}`;
}

/** "21:00:00" → "9:00 PM" / "21:00"; null when unparseable. */
export function formatPushTime(value: unknown, locale: PushLocale): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = match[2];
  if (hours > 23 || Number(minutes) > 59) return null;
  if (locale === "es") return `${match[1]}:${minutes}`;
  const suffix = hours < 12 ? "AM" : "PM";
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${h12}:${minutes} ${suffix}`;
}

function when(payload: Record<string, unknown>, locale: PushLocale): string | null {
  const date = formatPushDate(payload.date, locale);
  if (!date) return null;
  const time = formatPushTime(payload.time, locale);
  return time ? `${date} ${time}` : date;
}

function joinParts(parts: (string | null)[]): string {
  return parts.filter((part): part is string => !!part).join(" · ");
}

export function pushMessagePath(
  type: PushEventType,
  entityId: string,
  bandId: number
): string {
  const base =
    type === "show.created"
      ? "/shows/"
      : type === "rehearsal.created"
        ? "/rehearsals/"
        : "/setlists/";
  return `${base}${encodeURIComponent(entityId)}?band=${bandId}`;
}

export function buildPushMessage(input: PushMessageInput): PushMessage {
  const { type, bandId, entityId, payload, locale } = input;
  const t = TEXT[locale];
  const band = text(input.bandName) ?? "Bandmate";
  const actor = text(input.actorName) ?? t.someone;
  const name = text(payload.name);

  let title: string;
  let body: string;
  switch (type) {
    case "show.created":
      title = `${band} · ${t.showTitle}`;
      body = joinParts([
        t.added(actor, name ?? t.untitled),
        when(payload, locale),
        text(payload.venue),
      ]);
      break;
    case "rehearsal.created":
      title = `${band} · ${t.rehearsalTitle}`;
      body = joinParts([
        name ? t.added(actor, name) : t.addedRehearsal(actor),
        when(payload, locale),
        text(payload.location),
      ]);
      break;
    case "setlist.published": {
      title = `${band} · ${t.setlistTitle}`;
      const count = typeof payload.songCount === "number" ? payload.songCount : 0;
      body = joinParts([
        t.added(actor, name ?? t.untitled),
        count > 0 ? t.songs(count) : null,
      ]);
      break;
    }
  }

  return {
    title,
    body,
    url: pushMessagePath(type, entityId, bandId),
    tag: `${type}:${entityId}`,
  };
}
