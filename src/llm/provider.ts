import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type LLMProviderType = "openai" | "anthropic" | "ollama";

export interface ModelConfig {
  provider: LLMProviderType;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export function createModel(config: ModelConfig): LanguageModel {
  switch (config.provider) {
    case "openai": {
      const openai = createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      });

      return openai(config.model);
    }
    case "anthropic":
      // TODO [VR]: Add @ai-sdk/anthropic when needed
      throw new Error("Anthropic provider not yet implemented");
    case "ollama":
      // TODO [VR]: Add ollama-ai-provider when needed
      throw new Error("Ollama provider not yet implemented");
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

export function isLLMConfigured(config: ModelConfig): boolean {
  if (config.provider === "openai" || config.provider === "anthropic") {
    return !!config.apiKey;
  }

  // Ollama doesn't require an API key
  if (config.provider === "ollama") {
    return true;
  }

  return false;
}
