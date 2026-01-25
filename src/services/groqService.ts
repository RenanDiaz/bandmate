/**
 * Groq AI Service
 *
 * Provides LLM capabilities using Groq's free tier API.
 * Used for AI-powered features like setlist generation and song suggestions.
 *
 * Setup:
 * 1. Create an account at https://console.groq.com
 * 2. Get your API key from the dashboard
 * 3. Add to .env: VITE_GROQ_API_KEY
 */

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

class GroqService {
  private apiKey: string;
  private baseUrl = "https://api.groq.com/openai/v1";

  constructor() {
    this.apiKey = import.meta.env.VITE_GROQ_API_KEY || "";

    if (!this.apiKey) {
      console.warn(
        "Groq API key not configured. Set VITE_GROQ_API_KEY in .env to enable AI features."
      );
    }
  }

  /**
   * Check if Groq API is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Send a chat completion request to Groq
   */
  async chat(
    messages: GroqMessage[],
    options: GroqCompletionOptions = {}
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error("Groq API not configured. Please add VITE_GROQ_API_KEY to your .env file.");
    }

    const {
      model = GROQ_MODELS.LLAMA_3_3_70B,
      temperature = 0.7,
      maxTokens = 2048,
      topP = 1,
    } = options;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          top_p: topP,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("Groq API error:", response.status, errorBody);

        if (response.status === 401) {
          throw new Error("Invalid Groq API key. Please check your VITE_GROQ_API_KEY.");
        }
        if (response.status === 429) {
          throw new Error("Groq API rate limit exceeded. Please try again later.");
        }
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data: GroqChatResponse = await response.json();
      return data.choices[0]?.message?.content || "";
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to communicate with Groq API");
    }
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
