/**
 * Request validation and error mapping for the `groq-chat` Edge Function,
 * which holds the Groq API key server-side (it used to be the public
 * `VITE_GROQ_API_KEY`). Dependency-free so the app's tests can import it
 * (src/lib/__tests__/groqProxy.test.ts).
 */

/**
 * Models the app may ask for; anything else is refused. Keep in sync with
 * `GROQ_MODELS` in src/services/groqService.ts. Groq retired the Llama 3.x
 * models on 2026-08-16 (https://console.groq.com/docs/deprecations).
 */
export const GROQ_ALLOWED_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"] as const;

export const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";

/** Caps that keep one signed-in user from spending the key on huge calls. */
export const GROQ_LIMITS = {
  maxMessages: 20,
  /** Characters across every message (a band's whole library fits). */
  maxTotalChars: 120_000,
  maxTokens: 4096,
} as const;

export type GroqRole = "system" | "user" | "assistant";

export interface GroqChatRequest {
  model: string;
  messages: { role: GroqRole; content: string }[];
  temperature: number;
  max_tokens: number;
  top_p: number;
  /**
   * gpt-oss models reason before answering, and the reasoning counts against
   * `max_tokens`; "low" keeps room for the JSON the app asks for.
   */
  reasoning_effort?: "low" | "medium" | "high";
}

export type ParsedGroqRequest =
  | { ok: true; request: GroqChatRequest }
  | { ok: false; error: "invalid-request" | "too-large" };

const ROLES: readonly string[] = ["system", "user", "assistant"];

function numberIn(value: unknown, min: number, max: number, fallback: number): number | null {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) return null;
  return value;
}

/**
 * Body: `{ messages: { role, content }[], model?, temperature?, maxTokens?, topP? }`
 * (the client's `GroqCompletionOptions` names). Returns the Groq API body.
 */
export function parseGroqChatRequest(body: unknown): ParsedGroqRequest {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid-request" };
  const b = body as Record<string, unknown>;

  const messages = b.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > GROQ_LIMITS.maxMessages) {
    return { ok: false, error: "invalid-request" };
  }
  let totalChars = 0;
  const clean: GroqChatRequest["messages"] = [];
  for (const m of messages) {
    if (!m || typeof m !== "object") return { ok: false, error: "invalid-request" };
    const { role, content } = m as Record<string, unknown>;
    if (typeof role !== "string" || !ROLES.includes(role) || typeof content !== "string") {
      return { ok: false, error: "invalid-request" };
    }
    totalChars += content.length;
    clean.push({ role: role as GroqRole, content });
  }
  if (totalChars > GROQ_LIMITS.maxTotalChars) return { ok: false, error: "too-large" };

  const model = b.model ?? GROQ_DEFAULT_MODEL;
  if (typeof model !== "string" || !(GROQ_ALLOWED_MODELS as readonly string[]).includes(model)) {
    return { ok: false, error: "invalid-request" };
  }

  const temperature = numberIn(b.temperature, 0, 2, 0.7);
  const maxTokens = numberIn(b.maxTokens, 1, GROQ_LIMITS.maxTokens, 2048);
  const topP = numberIn(b.topP, 0, 1, 1);
  if (temperature === null || maxTokens === null || topP === null || !Number.isInteger(maxTokens)) {
    return { ok: false, error: "invalid-request" };
  }

  return {
    ok: true,
    request: {
      model,
      messages: clean,
      temperature,
      max_tokens: maxTokens,
      top_p: topP,
      ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" as const } : {}),
    },
  };
}

/**
 * What the function answers when Groq fails. A bad or missing key is the
 * server's problem, so it never comes back as a 401 (the client would read
 * that as "you are signed out").
 */
export function groqUpstreamError(status: number): { status: number; error: string } {
  if (status === 413) return { status: 413, error: "too-large" };
  if (status === 429) return { status: 429, error: "rate-limited" };
  if (status === 401 || status === 403) return { status: 502, error: "upstream-auth" };
  return { status: 502, error: "upstream-error" };
}
