import { describe, expect, it } from "vitest";
import {
  GROQ_DEFAULT_MODEL,
  GROQ_LIMITS,
  groqUpstreamError,
  parseGroqChatRequest,
} from "../../../supabase/functions/_shared/groqProxy";

const user = (content = "hi") => ({ role: "user", content });

describe("parseGroqChatRequest", () => {
  it("applies the defaults and maps the client's option names", () => {
    const parsed = parseGroqChatRequest({ messages: [user()] });
    expect(parsed).toEqual({
      ok: true,
      request: {
        model: GROQ_DEFAULT_MODEL,
        messages: [{ role: "user", content: "hi" }],
        temperature: 0.7,
        max_tokens: 2048,
        top_p: 1,
      },
    });
  });

  it("passes allowed options through", () => {
    const parsed = parseGroqChatRequest({
      messages: [{ role: "system", content: "s" }, user()],
      model: "llama-3.1-8b-instant",
      temperature: 0.2,
      maxTokens: 512,
      topP: 0.9,
    });
    expect(parsed.ok && parsed.request).toMatchObject({
      model: "llama-3.1-8b-instant",
      temperature: 0.2,
      max_tokens: 512,
      top_p: 0.9,
    });
  });

  it("drops fields other than role and content", () => {
    const parsed = parseGroqChatRequest({ messages: [{ role: "user", content: "x", name: "evil" }] });
    expect(parsed.ok && parsed.request.messages).toEqual([{ role: "user", content: "x" }]);
  });

  it.each([
    ["no body", null],
    ["no messages", {}],
    ["empty messages", { messages: [] }],
    ["too many messages", { messages: Array.from({ length: GROQ_LIMITS.maxMessages + 1 }, () => user()) }],
    ["unknown role", { messages: [{ role: "tool", content: "x" }] }],
    ["non-string content", { messages: [{ role: "user", content: 1 }] }],
    ["model outside the list", { messages: [user()], model: "gpt-4" }],
    ["temperature out of range", { messages: [user()], temperature: 3 }],
    ["maxTokens above the cap", { messages: [user()], maxTokens: GROQ_LIMITS.maxTokens + 1 }],
    ["fractional maxTokens", { messages: [user()], maxTokens: 10.5 }],
    ["topP out of range", { messages: [user()], topP: -0.1 }],
  ])("refuses %s", (_label, body) => {
    expect(parseGroqChatRequest(body)).toEqual({ ok: false, error: "invalid-request" });
  });

  it("answers too-large past the character cap", () => {
    const big = "x".repeat(GROQ_LIMITS.maxTotalChars / 2 + 1);
    expect(parseGroqChatRequest({ messages: [user(big), user(big)] })).toEqual({ ok: false, error: "too-large" });
  });
});

describe("groqUpstreamError", () => {
  it("keeps 413 and 429 for the client and never answers 401 for a bad key", () => {
    expect(groqUpstreamError(413)).toEqual({ status: 413, error: "too-large" });
    expect(groqUpstreamError(429)).toEqual({ status: 429, error: "rate-limited" });
    expect(groqUpstreamError(401)).toEqual({ status: 502, error: "upstream-auth" });
    expect(groqUpstreamError(403)).toEqual({ status: 502, error: "upstream-auth" });
    expect(groqUpstreamError(500)).toEqual({ status: 502, error: "upstream-error" });
  });
});
