import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("../../lib/supabaseClient", () => ({ supabase: { auth: {}, functions: { invoke } } }));

const { groqService, GroqApiError } = await import("../groqService");
const { spotifyService } = await import("../spotifyService");

/** What supabase-js returns when the function answers non-2xx. */
function httpError(status: number, body: Record<string, unknown>) {
  return {
    data: null,
    error: Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      context: new Response(JSON.stringify(body), { status }),
    }),
  };
}

beforeEach(() => {
  invoke.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("groqService", () => {
  it("offers the AI features only with VITE_AI_FEATURES=true", () => {
    vi.stubEnv("VITE_AI_FEATURES", "");
    expect(groqService.isConfigured()).toBe(false);
    vi.stubEnv("VITE_AI_FEATURES", "true");
    expect(groqService.isConfigured()).toBe(true);
  });

  it("sends the messages and options to groq-chat and returns its content", async () => {
    vi.stubEnv("VITE_AI_FEATURES", "true");
    invoke.mockResolvedValue({ data: { content: "ok" }, error: null });

    await expect(groqService.complete("prompt", "system", { temperature: 0.3, maxTokens: 100 })).resolves.toBe("ok");
    expect(invoke).toHaveBeenCalledWith("groq-chat", {
      body: {
        messages: [
          { role: "system", content: "system" },
          { role: "user", content: "prompt" },
        ],
        model: "openai/gpt-oss-120b",
        temperature: 0.3,
        maxTokens: 100,
        topP: 1,
      },
    });
  });

  it("never calls the function when the AI features are off", async () => {
    vi.stubEnv("VITE_AI_FEATURES", "");
    await expect(groqService.complete("prompt")).rejects.toThrow();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("turns a 413 into GroqApiError(413), which the callers retry in compact mode", async () => {
    vi.stubEnv("VITE_AI_FEATURES", "true");
    invoke.mockResolvedValue(httpError(413, { error: "too-large" }));
    const error = await groqService.complete("prompt").catch((e) => e);
    expect(error).toBeInstanceOf(GroqApiError);
    expect(error.status).toBe(413);
  });

  it.each([
    [429, "rate-limited", /rate limit/i],
    [500, "not-configured", /isn't set up/i],
    [502, "upstream-auth", /isn't set up/i],
    [401, "not-authenticated", /sign in again/i],
  ])("maps %i %s to a readable error", async (status, code, message) => {
    vi.stubEnv("VITE_AI_FEATURES", "true");
    invoke.mockResolvedValue(httpError(status, { error: code }));
    await expect(groqService.complete("prompt")).rejects.toThrow(message);
  });
});

describe("spotifyService", () => {
  it("returns the function's metadata", async () => {
    const metadata = { title: "Blackbird", artist: "The Beatles", duration: 138 };
    invoke.mockResolvedValue({ data: { metadata }, error: null });

    await expect(spotifyService.getSongMetadata("Blackbird", "The Beatles")).resolves.toEqual(metadata);
    expect(invoke).toHaveBeenCalledWith("spotify-metadata", { body: { title: "Blackbird", artist: "The Beatles" } });
  });

  it("returns null for no match, a function error or a network failure", async () => {
    invoke.mockResolvedValueOnce({ data: { metadata: null }, error: null });
    await expect(spotifyService.getSongMetadata("Nope")).resolves.toBeNull();

    invoke.mockResolvedValueOnce(httpError(500, { error: "not-configured" }));
    await expect(spotifyService.getSongMetadata("Blackbird")).resolves.toBeNull();

    invoke.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(spotifyService.getSongMetadata("Blackbird")).resolves.toBeNull();
  });

  it("does not call the function for a blank title", async () => {
    await expect(spotifyService.getSongMetadata("  ")).resolves.toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });
});
