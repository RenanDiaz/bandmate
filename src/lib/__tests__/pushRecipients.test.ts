import { describe, expect, it } from "vitest";
import {
  isSubscriptionGone,
  secretsMatch,
  selectInvitee,
  selectRecipients,
} from "../../../supabase/functions/_shared/pushRecipients";

const NOW = new Date("2026-09-27T12:00:00Z");

describe("push recipients", () => {
  it("leaves out the actor and muted members", () => {
    const members = [
      { user_id: "actor", expires_at: null },
      { user_id: "b", expires_at: null },
      { user_id: "muted", expires_at: null },
      { user_id: "c", expires_at: null },
    ];
    expect(selectRecipients(members, ["muted"], "actor", NOW)).toEqual(["b", "c"]);
  });

  it("keeps guests until their membership expires", () => {
    const members = [
      { user_id: "guest-ok", expires_at: "2026-10-01T00:00:00Z" },
      { user_id: "guest-expired", expires_at: "2026-09-01T00:00:00Z" },
    ];
    expect(selectRecipients(members, [], "actor", NOW)).toEqual(["guest-ok"]);
  });

  it("lists each user once", () => {
    const members = [
      { user_id: "b", expires_at: null },
      { user_id: "b", expires_at: null },
    ];
    expect(selectRecipients(members, new Set<string>(), "actor", NOW)).toEqual(["b"]);
  });

  it("sends an invitation to the invitee alone", () => {
    expect(selectInvitee("invitee", ["owner", "b"], [], "owner")).toEqual(["invitee"]);
  });

  it("skips an invitee who is the actor, already a member, muted or missing", () => {
    expect(selectInvitee("owner", [], [], "owner")).toEqual([]);
    expect(selectInvitee("b", ["b"], [], "owner")).toEqual([]);
    expect(selectInvitee("c", [], ["c"], "owner")).toEqual([]);
    expect(selectInvitee(undefined, [], [], "owner")).toEqual([]);
    expect(selectInvitee("", [], [], "owner")).toEqual([]);
  });

  it("treats 404 and 410 as a dead subscription", () => {
    expect(isSubscriptionGone(410)).toBe(true);
    expect(isSubscriptionGone(404)).toBe(true);
    expect(isSubscriptionGone(429)).toBe(false);
    expect(isSubscriptionGone(500)).toBe(false);
  });

  it("matches secrets exactly", () => {
    expect(secretsMatch("s3cret", "s3cret")).toBe(true);
    expect(secretsMatch("s3cre", "s3cret")).toBe(false);
    expect(secretsMatch("s3cret!", "s3cret")).toBe(false);
    expect(secretsMatch("S3cret", "s3cret")).toBe(false);
    expect(secretsMatch(null, "s3cret")).toBe(false);
    expect(secretsMatch("", "")).toBe(false);
  });
});
