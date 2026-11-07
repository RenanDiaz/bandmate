import { describe, expect, it } from "vitest";
import { signInHelpResultFromBody } from "../bandMembersService";

describe("signInHelpResultFromBody", () => {
  it("reads too-soon with its wait", () => {
    expect(signInHelpResultFromBody({ error: "too-soon", retryAfterSeconds: 61.2 })).toEqual({
      ok: false,
      reason: "too-soon",
      retryAfterSeconds: 62,
    });
    expect(signInHelpResultFromBody({ error: "too-soon" })).toEqual({
      ok: false,
      reason: "too-soon",
      retryAfterSeconds: 600,
    });
  });

  it("keeps known codes and maps the rest to failed", () => {
    expect(signInHelpResultFromBody({ error: "no-email" })).toEqual({ ok: false, reason: "no-email" });
    expect(signInHelpResultFromBody({ error: "forbidden" })).toEqual({ ok: false, reason: "forbidden" });
    expect(signInHelpResultFromBody({ error: "send-failed" })).toEqual({ ok: false, reason: "failed" });
    expect(signInHelpResultFromBody(null)).toEqual({ ok: false, reason: "failed" });
  });
});
