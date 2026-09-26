import { describe, expect, it } from "vitest";
import {
  addDays,
  buildIcsCalendar,
  escapeIcsText,
  eventTimeLines,
  foldIcsLine,
  rehearsalToIcsEvent,
  showToIcsEvent,
  showToIcsEvents,
  soundcheckToIcsEvent,
} from "../../../supabase/functions/_shared/ics";
import { getCalendarSubscribeLinks } from "../../services/calendarSubscriptionService";

describe("ics builder", () => {
  it("escapes text, including CRLF and lone CR", () => {
    expect(escapeIcsText("a,b;c\\d\r\ne\rf\ng")).toBe(
      "a\\,b\\;c\\\\d\\ne\\nf\\ng"
    );
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("makes all-day events end the next day", () => {
    expect(eventTimeLines({ uid: "x", summary: "s", date: "2026-02-28" })).toEqual([
      "DTSTART;VALUE=DATE:20260228",
      "DTEND;VALUE=DATE:20260301",
    ]);
  });

  it("defaults to two hours and rolls past midnight instead of writing hour 24+", () => {
    expect(
      eventTimeLines({ uid: "x", summary: "s", date: "2026-12-31", startTime: "23:30:00" })
    ).toEqual(["DTSTART:20261231T233000", "DTEND:20270101T013000"]);
  });

  it("uses the end time, next day when it is before the start", () => {
    expect(
      eventTimeLines({
        uid: "x",
        summary: "s",
        date: "2026-05-01",
        startTime: "19:00",
        endTime: "21:15",
      })
    ).toEqual(["DTSTART:20260501T190000", "DTEND:20260501T211500"]);
    expect(
      eventTimeLines({
        uid: "x",
        summary: "s",
        date: "2026-05-01",
        startTime: "22:00",
        endTime: "01:00",
      })
    ).toEqual(["DTSTART:20260501T220000", "DTEND:20260502T010000"]);
  });

  it("folds long lines at 75 octets without splitting UTF-8 characters", () => {
    const line = `DESCRIPTION:${"ñ".repeat(100)}`;
    const folded = foldIcsLine(line);
    const physical = folded.split("\r\n");
    const encoder = new TextEncoder();
    for (const part of physical) {
      expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
    }
    expect(physical.map((p, i) => (i === 0 ? p : p.slice(1))).join("")).toBe(line);
  });

  it("builds a calendar with shows and rehearsals", () => {
    const ics = buildIcsCalendar(
      {
        prodId: "-//Bandmate//Test//EN",
        name: "Los Canción (Bandmate)",
        timezone: "America/Panama",
        refreshHours: 6,
        events: [
          showToIcsEvent(
            {
              id: "s1",
              name: "Gig, live",
              venue: "Club",
              venue_address: "Calle 50",
              event_date: "2026-10-10",
              event_time: "21:00:00",
              soundcheck_time: "18:00:00",
              status: "cancelled",
              updated_at: "2026-09-01T10:00:00Z",
            },
            undefined,
            "https://www.bandmate.space"
          ),
          rehearsalToIcsEvent({
            id: "r1",
            name: "Full run",
            rehearsal_date: "2026-10-08",
            start_time: "19:00:00",
            end_time: "22:00:00",
            status: "scheduled",
          }),
        ],
      },
      new Date("2026-09-26T12:00:00Z")
    );

    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("X-WR-TIMEZONE:America/Panama");
    expect(ics).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT6H");
    expect(ics).toContain("UID:show-s1@bandmate");
    expect(ics).toContain("SUMMARY:Gig\\, live");
    expect(ics).toContain("LOCATION:Club\\, Calle 50");
    expect(ics).toContain("DESCRIPTION:Soundcheck: 18:00");
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).toContain("LAST-MODIFIED:20260901T100000Z");
    expect(ics).toContain("URL:https://www.bandmate.space/shows/s1");
    expect(ics).toContain("UID:rehearsal-r1@bandmate");
    expect(ics).toContain("SUMMARY:Rehearsal: Full run");
    expect(ics).toContain("DTEND:20261008T220000");
    expect(ics).toContain("DTSTAMP:20260926T120000Z");
  });
});

describe("soundcheck events", () => {
  const show = {
    id: "s1",
    name: "Gig",
    venue: "Club",
    event_date: "2026-10-10",
    event_time: "21:00:00",
    status: "scheduled",
    notes: "Bring the spare cable",
  };

  it("is omitted when the show has no soundcheck", () => {
    expect(soundcheckToIcsEvent(show)).toBeNull();
    expect(showToIcsEvents(show).map((e) => e.uid)).toEqual([
      "show-s1@bandmate",
    ]);
  });

  it("runs from the soundcheck to doors, with the show's place, notes and url", () => {
    const event = soundcheckToIcsEvent(
      { ...show, soundcheck_time: "18:00:00", doors_time: "20:00:00" },
      undefined,
      "https://www.bandmate.space"
    );
    expect(event).toMatchObject({
      uid: "show-s1-soundcheck@bandmate",
      summary: "Soundcheck: Gig",
      date: "2026-10-10",
      startTime: "18:00:00",
      endTime: "20:00:00",
      location: "Club",
      description: "Bring the spare cable",
      status: "CONFIRMED",
      url: "https://www.bandmate.space/shows/s1",
    });
  });

  it("ends at show time when there are no doors, and after an hour when neither is later", () => {
    const untilShow = soundcheckToIcsEvent({
      ...show,
      soundcheck_time: "18:00:00",
    });
    expect(eventTimeLines(untilShow!)).toEqual([
      "DTSTART:20261010T180000",
      "DTEND:20261010T210000",
    ]);

    const afterShow = soundcheckToIcsEvent({
      ...show,
      soundcheck_time: "22:30:00",
      doors_time: "20:00:00",
    });
    expect(afterShow!.endTime).toBeUndefined();
    expect(eventTimeLines(afterShow!)).toEqual([
      "DTSTART:20261010T223000",
      "DTEND:20261010T233000",
    ]);
  });

  it("is cancelled with the show and uses the localized label", () => {
    const event = soundcheckToIcsEvent(
      { ...show, soundcheck_time: "18:00:00", status: "cancelled" },
      { soundcheck: "Prueba de sonido", doors: "Puertas", rehearsal: "Ensayo", formatTime: (t) => t.slice(0, 5) }
    );
    expect(event).toMatchObject({
      summary: "Prueba de sonido: Gig",
      status: "CANCELLED",
    });
  });

  it("keeps the show event unchanged and adds the soundcheck after it", () => {
    const events = showToIcsEvents({ ...show, soundcheck_time: "18:00:00" });
    expect(events.map((e) => e.uid)).toEqual([
      "show-s1@bandmate",
      "show-s1-soundcheck@bandmate",
    ]);
    expect(events[0].startTime).toBe("21:00:00");
    expect(events[0].description).toBe("Soundcheck: 18:00\nBring the spare cable");
  });
});

describe("getCalendarSubscribeLinks", () => {
  it("builds webcal, Google and Outlook links from the feed URL", () => {
    const feed = "https://abc.supabase.co/functions/v1/calendar-feed?token=t";
    const links = getCalendarSubscribeLinks(feed, "Band (Bandmate)");
    expect(links.apple).toBe("webcal://abc.supabase.co/functions/v1/calendar-feed?token=t");
    expect(links.google).toBe(
      `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(links.apple)}`
    );
    expect(links.outlook).toContain(`url=${encodeURIComponent(feed)}`);
  });
});
