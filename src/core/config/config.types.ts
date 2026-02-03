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

export interface AgentModelOverride {
  model?: string;
}

export interface AgentConfigOverride {
  model?: AgentModelOverride;
  systemPrompt?: string;
}

export interface AgentsConfig {
  planner?: AgentConfigOverride;
  synthesizer?: AgentConfigOverride;
}

export interface Config {
  telegram?: TelegramConfig;
  llm: LLMConfig;
  maxToolCalls?: number; // Maximum number of tool calls per request (default: 5)
  agents?: AgentsConfig; // Optional overrides for specific agents
}
