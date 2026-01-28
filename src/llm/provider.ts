// TODO [VR]: Implement LLM providers - openai, anthropic, ollama for v1

/**
 * Message format for LLM conversations.
 */
export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string; // For tool messages
}

/**
 * Tool definition for LLM function calling.
 */
export interface LLMTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

/**
 * Response from LLM.
 */
export interface LLMResponse {
  content: string;
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
  finishReason: "stop" | "tool_calls" | "length" | "error";
}

/**
 * Options for LLM completion.
 */
export interface LLMCompletionOptions {
  messages: LLMMessage[];
  tools?: LLMTool[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

/**
 * LLM Provider interface.
 */
export interface LLMProvider {
  /**
   * Provider name (e.g., "openai", "ollama").
   */
  name: string;

  /**
   * Generate a completion.
   */
  complete(options: LLMCompletionOptions): Promise<LLMResponse>;

  /**
   * Generate a streaming completion.
   */
  completeStream(
    options: LLMCompletionOptions,
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse>;
}

/**
 * Stub provider for MVP (no actual LLM calls).
 */
export class StubProvider implements LLMProvider {
  name = "stub";

  async complete(_options: LLMCompletionOptions): Promise<LLMResponse> {
    return {
      content: "[MVP Mode] LLM provider not configured. Please set up an LLM in config.toml.",
      finishReason: "stop",
    };
  }

  async completeStream(
    _options: LLMCompletionOptions,
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse> {
    const response = "[MVP Mode] LLM provider not configured.";
    onChunk(response);
    return {
      content: response,
      finishReason: "stop",
    };
  }
}
