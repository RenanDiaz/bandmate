import type { Show } from "../services/showsService";
import type { Rehearsal } from "../services/rehearsalsService";

/** A show or a rehearsal with its date and time normalized (`event_date` / `rehearsal_date`, `event_time` / `start_time`). */
export type UpcomingEvent =
  | { type: "show"; id: string; bandId: number; date: string; time?: string; data: Show }
  | { type: "rehearsal"; id: string; bandId: number; date: string; time?: string; data: Rehearsal };

export interface UpcomingEventLink {
  labelKey: "home.setlist" | "home.show";
  path: string;
}

function compareEvents(a: UpcomingEvent, b: UpcomingEvent, bandNameById?: ReadonlyMap<number, string>): number {
  // `YYYY-MM-DD` and `HH:MM[:SS]` sort as strings; new Date("YYYY-MM-DD") would parse as UTC.
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.time !== b.time) {
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time < b.time ? -1 : 1;
  }
  if (bandNameById) {
    const byBand = (bandNameById.get(a.bandId) ?? "").localeCompare(bandNameById.get(b.bandId) ?? "");
    if (byBand !== 0) return byBand;
  }
  return (a.data.name ?? "").localeCompare(b.data.name ?? "");
}

/** Merge and sort by date, then time (missing time last), then band name, then name. */
export function mergeUpcomingEvents(
  shows: Show[],
  rehearsals: Rehearsal[],
  bandNameById?: ReadonlyMap<number, string>
): UpcomingEvent[] {
  const events: UpcomingEvent[] = [
    ...shows.map((show): UpcomingEvent => ({
      type: "show",
      id: show.id,
      bandId: show.band_id,
      date: show.event_date,
      time: show.event_time || undefined,
      data: show,
    })),
    ...rehearsals.map((rehearsal): UpcomingEvent => ({
      type: "rehearsal",
      id: rehearsal.id,
      bandId: rehearsal.band_id,
      date: rehearsal.rehearsal_date,
      time: rehearsal.start_time || undefined,
      data: rehearsal,
    })),
  ];
  return events.sort((a, b) => compareEvents(a, b, bandNameById));
}

/** Route of the event itself. */
export function eventPath(event: UpcomingEvent): string {
  return event.type === "show" ? `/shows/${event.id}` : `/rehearsals/${event.id}`;
}

/** The secondary link, when the row has one: a show's setlist, a rehearsal's show. */
export function eventLink(event: UpcomingEvent): UpcomingEventLink | null {
  if (event.type === "show") {
    return event.data.setlist_id ? { labelKey: "home.setlist", path: `/setlists/${event.data.setlist_id}` } : null;
  }
  return event.data.show_id ? { labelKey: "home.show", path: `/shows/${event.data.show_id}` } : null;
}
