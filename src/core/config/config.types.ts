export type LLMProvider = "openai" | "ollama";

export interface TelegramConfig {
  botToken: string;
}

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface Config {
  telegram?: TelegramConfig;
  llm: LLMConfig;
}
