import { describe, expect, it } from "vitest";
import type { Show } from "../../services/showsService";
import type { Rehearsal } from "../../services/rehearsalsService";
import { eventLink, eventPath, mergeUpcomingEvents } from "../upcomingEvents";

function show(id: string, event_date: string, extra: Partial<Show> = {}): Show {
  return {
    id,
    band_id: 1,
    user_id: "u",
    name: `Show ${id}`,
    event_date,
    status: "upcoming",
    created_at: "",
    updated_at: "",
    ...extra,
  };
}

function rehearsal(id: string, rehearsal_date: string, extra: Partial<Rehearsal> = {}): Rehearsal {
  return {
    id,
    band_id: 1,
    user_id: "u",
    name: `Rehearsal ${id}`,
    rehearsal_date,
    status: "scheduled",
    created_at: "",
    updated_at: "",
    ...extra,
  };
}

const ids = (events: ReturnType<typeof mergeUpcomingEvents>) => events.map((e) => `${e.type}:${e.id}`);

describe("mergeUpcomingEvents (AC1)", () => {
  it("interleaves shows and rehearsals by date", () => {
    const events = mergeUpcomingEvents(
      [show("s1", "2026-10-05"), show("s2", "2026-10-01")],
      [rehearsal("r1", "2026-10-03"), rehearsal("r2", "2026-12-01")]
    );
    expect(ids(events)).toEqual(["show:s2", "rehearsal:r1", "show:s1", "rehearsal:r2"]);
  });

  it("compares dates as strings, never through UTC parsing", () => {
    const events = mergeUpcomingEvents([show("s1", "2026-10-10")], [rehearsal("r1", "2026-10-09")]);
    expect(ids(events)).toEqual(["rehearsal:r1", "show:s1"]);
  });

  it("normalizes date and time from each table's fields", () => {
    const [r, s] = mergeUpcomingEvents(
      [show("s1", "2026-10-02", { event_time: "21:00:00", band_id: 4 })],
      [rehearsal("r1", "2026-10-01", { start_time: "18:30:00", band_id: 5 })]
    );
    expect(r).toMatchObject({ type: "rehearsal", id: "r1", bandId: 5, date: "2026-10-01", time: "18:30:00" });
    expect(s).toMatchObject({ type: "show", id: "s1", bandId: 4, date: "2026-10-02", time: "21:00:00" });
  });

  it("same date: by time, events without a time last", () => {
    const events = mergeUpcomingEvents(
      [show("late", "2026-10-01", { event_time: "21:00:00" }), show("none", "2026-10-01")],
      [rehearsal("early", "2026-10-01", { start_time: "09:00" }), rehearsal("empty", "2026-10-01", { start_time: "" })]
    );
    expect(ids(events)).toEqual(["rehearsal:early", "show:late", "rehearsal:empty", "show:none"]);
  });

  it("same date and time: by band name, then by name", () => {
    const bandNames = new Map([
      [1, "Zeta"],
      [2, "Alpha"],
    ]);
    const events = mergeUpcomingEvents(
      [
        show("z", "2026-10-01", { event_time: "20:00:00", band_id: 1, name: "A gig" }),
        show("b", "2026-10-01", { event_time: "20:00:00", band_id: 2, name: "B gig" }),
        show("a", "2026-10-01", { event_time: "20:00:00", band_id: 2, name: "A gig" }),
      ],
      [],
      bandNames
    );
    expect(ids(events)).toEqual(["show:a", "show:b", "show:z"]);
  });

  it("without band names: same date and time by name; a rehearsal without a name sorts first", () => {
    const events = mergeUpcomingEvents(
      [show("s", "2026-10-01", { name: "Beta" })],
      [rehearsal("r", "2026-10-01", { name: "Alpha" }), rehearsal("n", "2026-10-01", { name: undefined })]
    );
    expect(ids(events)).toEqual(["rehearsal:n", "rehearsal:r", "show:s"]);
  });
});

describe("eventPath / eventLink (AC1)", () => {
  const [withSetlist, bareShow] = mergeUpcomingEvents(
    [show("s1", "2026-10-01", { setlist_id: "l1" }), show("s2", "2026-10-02", { setlist_id: null })],
    []
  );
  const [withShow, bareRehearsal] = mergeUpcomingEvents(
    [],
    [rehearsal("r1", "2026-10-01", { show_id: "s9", setlist_id: "l9" }), rehearsal("r2", "2026-10-02")]
  );

  it("paths of the events themselves", () => {
    expect(eventPath(withSetlist)).toBe("/shows/s1");
    expect(eventPath(withShow)).toBe("/rehearsals/r1");
  });

  it("a show links to its setlist, when it has one", () => {
    expect(eventLink(withSetlist)).toEqual({ labelKey: "home.setlist", path: "/setlists/l1" });
    expect(eventLink(bareShow)).toBeNull();
  });

  it("a rehearsal links to its show, when it has one (not to its setlist)", () => {
    expect(eventLink(withShow)).toEqual({ labelKey: "home.show", path: "/shows/s9" });
    expect(eventLink(bareRehearsal)).toBeNull();
  });
});
