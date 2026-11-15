/**
 * Groq AI Service
 *
 * LLM calls for the AI setlist features. The Groq API key never reaches the
 * browser: requests go through the `groq-chat` Edge Function
 * (supabase/functions/groq-chat), which holds `GROQ_API_KEY` and requires a
 * signed-in user. The UI shows the AI features only when the public flag
 * `VITE_AI_FEATURES=true` is set (not a secret: it says the server side is
 * set up).
 */

import { supabase } from "../lib/supabaseClient";

export class GroqApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "GroqApiError";
  }
}

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface GroqCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

// Available models on Groq free tier
export const GROQ_MODELS = {
  // Fast and efficient for most tasks
  LLAMA_3_1_8B: "llama-3.1-8b-instant",
  // More capable, versatile model (recommended)
  LLAMA_3_3_70B: "llama-3.3-70b-versatile",
  // Mixtral for diverse tasks
  MIXTRAL: "mixtral-8x7b-32768",
  // Gemma for lightweight tasks
  GEMMA_2_9B: "gemma2-9b-it",
} as const;

/** The error body the `groq-chat` function answers with (see its header). */
async function errorBody(context: unknown): Promise<{ code?: string; upstreamStatus?: number }> {
  if (!(context instanceof Response)) return {};
  try {
    const body = await context.clone().json();
    return {
      code: typeof body?.error === "string" ? body.error : undefined,
      upstreamStatus: typeof body?.upstreamStatus === "number" ? body.upstreamStatus : undefined,
    };
  } catch {
    return {};
  }
}

class GroqService {
  /**
   * Whether the AI features are offered. The key lives on the server, so
   * this is the public `VITE_AI_FEATURES` flag, set where `GROQ_API_KEY` is.
   */
  isConfigured(): boolean {
    return import.meta.env.VITE_AI_FEATURES === "true";
  }

  /**
   * Send a chat completion request through the `groq-chat` Edge Function.
   */
  async chat(
    messages: GroqMessage[],
    options: GroqCompletionOptions = {}
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error("AI features are not enabled.");
    }

    const {
      model = GROQ_MODELS.LLAMA_3_3_70B,
      temperature = 0.7,
      maxTokens = 2048,
      topP = 1,
    } = options;

    const { data, error } = await supabase.functions.invoke<{ content: string }>("groq-chat", {
      body: { messages, model, temperature, maxTokens, topP },
    });

    if (error) {
      // FunctionsHttpError: the function answered non-2xx; its Response is in `context`.
      const context = (error as { context?: unknown }).context;
      const status = context instanceof Response ? context.status : 0;
      const { code, upstreamStatus } = await errorBody(context);
      console.error("groq-chat error:", status, code ?? error.message, upstreamStatus ?? "");

      if (status === 413 || code === "too-large") {
        throw new GroqApiError("Request too large for the AI service. Try reducing the amount of data sent.", 413);
      }
      if (status === 429 || code === "rate-limited") {
        throw new Error("AI service rate limit exceeded. Please try again later.");
      }
      if (status === 401) {
        throw new Error("Sign in again to use the AI features.");
      }
      if (code === "not-configured" || code === "upstream-auth") {
        throw new Error("The AI service isn't set up on the server.");
      }
      if (!status) throw new Error("Failed to reach the AI service.");
      throw new Error(
        upstreamStatus ? `AI service error: ${status} (provider ${upstreamStatus})` : `AI service error: ${status}`
      );
    }

    return data?.content ?? "";
  }

  /**
   * Simple completion with a single prompt
   */
  async complete(
    prompt: string,
    systemPrompt?: string,
    options: GroqCompletionOptions = {}
  ): Promise<string> {
    const messages: GroqMessage[] = [];

    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    messages.push({ role: "user", content: prompt });

    return this.chat(messages, options);
  }

  /**
   * Parse JSON from LLM response (handles markdown code blocks)
   */
  parseJsonResponse<T>(response: string): T {
    // Remove markdown code blocks if present
    let cleaned = response.trim();

    // Handle ```json ... ``` format
    const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
      cleaned = jsonBlockMatch[1].trim();
    }

    try {
      return JSON.parse(cleaned);
    } catch (error) {
      console.error("Failed to parse JSON response:", response);
      throw new Error("Failed to parse AI response as JSON");
    }
  }
}

// Export singleton instance
export const groqService = new GroqService();
