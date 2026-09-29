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
  | "setlist.published"
  | "show.moved"
  | "show.cancelled"
  | "rehearsal.moved"
  | "rehearsal.cancelled"
  | "invitation.created";

/** The entity an event is about: its path and its notification tag. */
export type PushEntityKind = "show" | "rehearsal" | "setlist" | "invitation";

export type PushLocale = "en" | "es";

/** What the service worker receives (JSON), and all it shows. */
export interface PushMessage {
  title: string;
  body: string;
  /**
   * App path to open on tap, with `?band=<id>` so the app selects the band.
   * An invitation opens `/`: the invitee isn't a member yet, and the
   * dashboard lists their pending invitations.
   */
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
  /**
   * notification_events.payload, as written by the triggers. Created events:
   * the row's fields. Moved / cancelled: `{ name, before, after }`, each a
   * `{ date, time, place, status }` snapshot; the message shows `after`.
   * Invitation: `{ inviteeId, role }`.
   */
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
    showMovedTitle: "Show moved",
    showCancelledTitle: "Show cancelled",
    rehearsalMovedTitle: "Rehearsal moved",
    rehearsalCancelledTitle: "Rehearsal cancelled",
    isNow: (name: string, when: string) => `"${name}" is now ${when}`,
    rehearsalIsNow: (when: string) => `The rehearsal is now ${when}`,
    invitationTitle: "Invitation",
    invited: (actor: string, role: string | null) =>
      role ? `${actor} invited you to join as ${role}` : `${actor} invited you to join the band`,
    roles: { admin: "an admin", member: "a member", guest: "a guest" } as Record<string, string>,
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
    showMovedTitle: "Cambio de show",
    showCancelledTitle: "Show cancelado",
    rehearsalMovedTitle: "Cambio de ensayo",
    rehearsalCancelledTitle: "Ensayo cancelado",
    isNow: (name: string, when: string) => `"${name}" ahora es el ${when}`,
    rehearsalIsNow: (when: string) => `El ensayo ahora es el ${when}`,
    invitationTitle: "Invitación",
    invited: (actor: string, role: string | null) =>
      role ? `${actor} te invitó a unirte como ${role}` : `${actor} te invitó a unirte a la banda`,
    roles: { admin: "administrador", member: "miembro", guest: "invitado" } as Record<string, string>,
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

function when(fields: Record<string, unknown>, locale: PushLocale): string | null {
  const date = formatPushDate(fields.date, locale);
  if (!date) return null;
  const time = formatPushTime(fields.time, locale);
  return time ? `${date} ${time}` : date;
}

function joinParts(parts: (string | null)[]): string {
  return parts.filter((part): part is string => !!part).join(" · ");
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function pushEntityKind(type: PushEventType): PushEntityKind {
  if (type.startsWith("show.")) return "show";
  if (type.startsWith("rehearsal.")) return "rehearsal";
  if (type.startsWith("invitation.")) return "invitation";
  return "setlist";
}

const PATHS: Record<Exclude<PushEntityKind, "invitation">, string> = {
  show: "/shows/",
  rehearsal: "/rehearsals/",
  setlist: "/setlists/",
};

export function pushMessagePath(
  type: PushEventType,
  entityId: string,
  bandId: number
): string {
  const kind = pushEntityKind(type);
  if (kind === "invitation") return "/";
  return `${PATHS[kind]}${encodeURIComponent(entityId)}?band=${bandId}`;
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
    case "show.moved":
    case "rehearsal.moved": {
      const after = record(payload.after);
      const isShow = type === "show.moved";
      title = `${band} · ${isShow ? t.showMovedTitle : t.rehearsalMovedTitle}`;
      // Date and time always, also when only the place changed.
      const at = when(after, locale) ?? "";
      const lead = isShow || name ? t.isNow(name ?? t.untitled, at) : t.rehearsalIsNow(at);
      body = joinParts([lead, text(after.place)]);
      break;
    }
    case "show.cancelled":
    case "rehearsal.cancelled": {
      const after = record(payload.after);
      const isShow = type === "show.cancelled";
      title = `${band} · ${isShow ? t.showCancelledTitle : t.rehearsalCancelledTitle}`;
      body = joinParts([
        isShow || name ? `"${name ?? t.untitled}"` : null,
        when(after, locale),
      ]);
      break;
    }
    case "invitation.created": {
      title = `${band} · ${t.invitationTitle}`;
      const role = typeof payload.role === "string" ? t.roles[payload.role] ?? null : null;
      body = t.invited(actor, role);
      break;
    }
  }

  return {
    title,
    body,
    url: pushMessagePath(type, entityId, bandId),
    // By entity: a "moved" replaces that show's "new show" in the tray.
    tag: `${pushEntityKind(type)}:${entityId}`,
  };
}
