import { describe, expect, it } from "vitest";
import {
  actorDisplayName,
  buildPushMessage,
  formatPushDate,
  formatPushTime,
  normalizePushLocale,
} from "../../../supabase/functions/_shared/pushMessages";
import type { PushMessageInput } from "../../../supabase/functions/_shared/pushMessages";

function input(overrides: Partial<PushMessageInput>): PushMessageInput {
  return {
    type: "show.created",
    bandId: 7,
    bandName: "Los Tigres",
    actorName: "Ana",
    entityId: "abc-123",
    payload: {},
    locale: "en",
    ...overrides,
  };
}

describe("push messages", () => {
  it("normalises locales to en / es", () => {
    expect(normalizePushLocale("es")).toBe("es");
    expect(normalizePushLocale("es-PA")).toBe("es");
    expect(normalizePushLocale("ES_419")).toBe("es");
    expect(normalizePushLocale("en-US")).toBe("en");
    expect(normalizePushLocale("pt")).toBe("en");
    expect(normalizePushLocale(undefined)).toBe("en");
  });

  it("formats date-only strings without shifting the day", () => {
    // 2026-10-10 is a Saturday wherever the test runs.
    expect(formatPushDate("2026-10-10", "en")).toBe("Sat, Oct 10");
    expect(formatPushDate("2026-10-10", "es")).toBe("sáb 10 oct");
    expect(formatPushDate("2026-01-01", "en")).toBe("Thu, Jan 1");
    expect(formatPushDate("10/10/2026", "en")).toBeNull();
    expect(formatPushDate("2026-13-01", "en")).toBeNull();
    expect(formatPushDate(null, "en")).toBeNull();
  });

  it("formats times as 12 h in English and 24 h in Spanish", () => {
    expect(formatPushTime("21:00:00", "en")).toBe("9:00 PM");
    expect(formatPushTime("21:00:00", "es")).toBe("21:00");
    expect(formatPushTime("00:30", "en")).toBe("12:30 AM");
    expect(formatPushTime("12:05:00", "en")).toBe("12:05 PM");
    expect(formatPushTime("09:15", "es")).toBe("09:15");
    expect(formatPushTime("25:00", "en")).toBeNull();
    expect(formatPushTime(null, "es")).toBeNull();
  });

  it("picks the actor name from metadata, then the email", () => {
    expect(actorDisplayName({ full_name: "Ana Pérez", name: "ana" }, "a@x.com")).toBe("Ana Pérez");
    expect(actorDisplayName({ full_name: "  ", name: "ana" }, "a@x.com")).toBe("ana");
    expect(actorDisplayName({}, "renan@example.com")).toBe("renan");
    expect(actorDisplayName(null, null)).toBeNull();
  });

  it("builds a show message with date, time and venue", () => {
    const message = buildPushMessage(
      input({
        payload: { name: "Bar X", date: "2026-10-10", time: "21:00:00", venue: "La Rana" },
      })
    );
    expect(message).toEqual({
      title: "Los Tigres · New show",
      body: 'Ana added "Bar X" · Sat, Oct 10 9:00 PM · La Rana',
      url: "/shows/abc-123?band=7",
      tag: "show:abc-123",
    });
  });

  it("builds the Spanish show message and leaves out missing parts", () => {
    const message = buildPushMessage(
      input({ locale: "es", payload: { name: "Bar X", date: "2026-10-10", time: null, venue: null } })
    );
    expect(message.title).toBe("Los Tigres · Nuevo show");
    expect(message.body).toBe('Ana agregó "Bar X" · sáb 10 oct');
  });

  it("builds rehearsal messages, named or not", () => {
    const unnamed = buildPushMessage(
      input({
        type: "rehearsal.created",
        payload: { name: null, date: "2026-09-29", time: "19:30:00", location: "Studio" },
      })
    );
    expect(unnamed.title).toBe("Los Tigres · New rehearsal");
    expect(unnamed.body).toBe("Ana added a rehearsal · Tue, Sep 29 7:30 PM · Studio");
    expect(unnamed.url).toBe("/rehearsals/abc-123?band=7");
    expect(unnamed.tag).toBe("rehearsal:abc-123");

    const named = buildPushMessage(
      input({
        type: "rehearsal.created",
        locale: "es",
        payload: { name: "Ensayo general", date: "2026-09-29", time: null, location: null },
      })
    );
    expect(named.title).toBe("Los Tigres · Nuevo ensayo");
    expect(named.body).toBe('Ana agregó "Ensayo general" · mar 29 sept');
  });

  it("builds setlist messages with a song count", () => {
    const en = buildPushMessage(
      input({ type: "setlist.published", payload: { name: "Fall tour", songCount: 12 } })
    );
    expect(en.title).toBe("Los Tigres · New setlist");
    expect(en.body).toBe('Ana added "Fall tour" · 12 songs');
    expect(en.url).toBe("/setlists/abc-123?band=7");
    expect(en.tag).toBe("setlist:abc-123");

    const one = buildPushMessage(
      input({ type: "setlist.published", locale: "es", payload: { name: "Corto", songCount: 1 } })
    );
    expect(one.body).toBe('Ana agregó "Corto" · 1 canción');

    const empty = buildPushMessage(
      input({ type: "setlist.published", payload: { name: "Empty", songCount: 0 } })
    );
    expect(empty.body).toBe('Ana added "Empty"');
  });

  it("falls back when the actor, band or name is missing", () => {
    const message = buildPushMessage(
      input({ actorName: "", bandName: " ", locale: "es", payload: { date: "2026-10-10" } })
    );
    expect(message.title).toBe("Bandmate · Nuevo show");
    expect(message.body).toBe('Alguien agregó "Sin nombre" · sáb 10 oct');
  });

  it("truncates long names so the payload stays small", () => {
    const message = buildPushMessage(input({ payload: { name: "x".repeat(200) } }));
    expect(message.body).toBe(`Ana added "${"x".repeat(79)}…"`);
  });

  it("encodes the entity id in the path", () => {
    const message = buildPushMessage(input({ entityId: "a/b?c" }));
    expect(message.url).toBe("/shows/a%2Fb%3Fc?band=7");
  });

  describe("moved and cancelled (Phase 2)", () => {
    const show = (after: Record<string, unknown>) => ({
      name: "Bar X",
      before: { date: "2026-10-10", time: "21:00:00", place: "La Rana", status: "upcoming" },
      after: { status: "upcoming", ...after },
    });

    it("builds show moved in both languages, from the final values", () => {
      const payload = show({ date: "2026-10-17", time: "22:00:00", place: "El Sapo" });
      expect(buildPushMessage(input({ type: "show.moved", payload }))).toEqual({
        title: "Los Tigres · Show moved",
        body: '"Bar X" is now Sat, Oct 17 10:00 PM · El Sapo',
        url: "/shows/abc-123?band=7",
        tag: "show:abc-123",
      });
      const es = buildPushMessage(input({ type: "show.moved", locale: "es", payload }));
      expect(es.title).toBe("Los Tigres · Cambio de show");
      expect(es.body).toBe('"Bar X" ahora es el sáb 17 oct 22:00 · El Sapo');
    });

    it("keeps date and time when only the place changed, and drops missing parts", () => {
      const placeOnly = buildPushMessage(
        input({ type: "show.moved", payload: show({ date: "2026-10-10", time: "21:00:00", place: "El Sapo" }) })
      );
      expect(placeOnly.body).toBe('"Bar X" is now Sat, Oct 10 9:00 PM · El Sapo');

      const bare = buildPushMessage(
        input({ type: "show.moved", locale: "es", payload: show({ date: "2026-10-10", time: null, place: null }) })
      );
      expect(bare.body).toBe('"Bar X" ahora es el sáb 10 oct');

      const unnamed = buildPushMessage(
        input({ type: "show.moved", payload: { after: { date: "2026-10-10" } } })
      );
      expect(unnamed.body).toBe('"Untitled" is now Sat, Oct 10');
    });

    it("builds rehearsal moved, named or not", () => {
      const after = { date: "2026-09-29", time: "19:30:00", place: "Studio", status: "scheduled" };
      const unnamed = buildPushMessage(input({ type: "rehearsal.moved", payload: { name: null, after } }));
      expect(unnamed.title).toBe("Los Tigres · Rehearsal moved");
      expect(unnamed.body).toBe("The rehearsal is now Tue, Sep 29 7:30 PM · Studio");
      expect(unnamed.url).toBe("/rehearsals/abc-123?band=7");
      expect(unnamed.tag).toBe("rehearsal:abc-123");

      const es = buildPushMessage(input({ type: "rehearsal.moved", locale: "es", payload: { name: null, after } }));
      expect(es.title).toBe("Los Tigres · Cambio de ensayo");
      expect(es.body).toBe("El ensayo ahora es el mar 29 sept 19:30 · Studio");

      const named = buildPushMessage(
        input({ type: "rehearsal.moved", locale: "es", payload: { name: "General", after } })
      );
      expect(named.body).toBe('"General" ahora es el mar 29 sept 19:30 · Studio');
    });

    it("builds cancelled messages without the actor", () => {
      const payload = show({ date: "2026-10-10", time: "21:00:00", place: "La Rana", status: "cancelled" });
      const en = buildPushMessage(input({ type: "show.cancelled", payload }));
      expect(en.title).toBe("Los Tigres · Show cancelled");
      expect(en.body).toBe('"Bar X" · Sat, Oct 10 9:00 PM');
      expect(en.tag).toBe("show:abc-123");
      expect(buildPushMessage(input({ type: "show.cancelled", locale: "es", payload })).title).toBe(
        "Los Tigres · Show cancelado"
      );

      const rehearsal = buildPushMessage(
        input({
          type: "rehearsal.cancelled",
          locale: "es",
          payload: { name: null, after: { date: "2026-09-29", time: null, place: "Studio", status: "cancelled" } },
        })
      );
      expect(rehearsal.title).toBe("Los Tigres · Ensayo cancelado");
      expect(rehearsal.body).toBe("mar 29 sept");
      expect(rehearsal.url).toBe("/rehearsals/abc-123?band=7");

      const named = buildPushMessage(
        input({ type: "rehearsal.cancelled", payload: { name: "General", after: { date: "2026-09-29" } } })
      );
      expect(named.title).toBe("Los Tigres · Rehearsal cancelled");
      expect(named.body).toBe('"General" · Tue, Sep 29');
    });

    it("tags every event of an entity alike, so a change replaces the creation", () => {
      const created = buildPushMessage(input({ type: "show.created", payload: { name: "Bar X" } }));
      const moved = buildPushMessage(input({ type: "show.moved", payload: show({ date: "2026-10-11" }) }));
      const cancelled = buildPushMessage(input({ type: "show.cancelled", payload: show({ date: "2026-10-11" }) }));
      expect(new Set([created.tag, moved.tag, cancelled.tag])).toEqual(new Set(["show:abc-123"]));
    });

    it("survives a payload without `after`", () => {
      const message = buildPushMessage(input({ type: "show.cancelled", payload: { name: "Bar X", after: "junk" } }));
      expect(message.body).toBe('"Bar X"');
    });
  });

  describe("invitations", () => {
    it("builds the invitation in both languages, with the role", () => {
      const en = buildPushMessage(
        input({ type: "invitation.created", payload: { inviteeId: "u1", role: "member" } })
      );
      expect(en.title).toBe("Los Tigres · Invitation");
      expect(en.body).toBe("Ana invited you to join as a member");
      const es = buildPushMessage(
        input({ type: "invitation.created", payload: { role: "guest" }, locale: "es" })
      );
      expect(es.title).toBe("Los Tigres · Invitación");
      expect(es.body).toBe("Ana te invitó a unirte como invitado");
    });

    it("leaves the role out when it is unknown", () => {
      const message = buildPushMessage(
        input({ type: "invitation.created", payload: { role: "owner" }, actorName: "" })
      );
      expect(message.body).toBe("Someone invited you to join the band");
    });

    it("opens the dashboard, never a band path, and tags by invitation", () => {
      const message = buildPushMessage(input({ type: "invitation.created", entityId: "inv-9" }));
      expect(message.url).toBe("/");
      expect(message.tag).toBe("invitation:inv-9");
    });
  });
});
