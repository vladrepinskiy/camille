import type { Config } from "@/core/config";
import { createModel } from "@/llm";
import type { LanguageModel } from "ai";
import { DEFAULT_AGENT_CONFIG } from "./agent.constants";
import type { AgentType } from "./agent.types";

export abstract class AbstractAgent {
  abstract readonly name: AgentType;

  protected model: LanguageModel;
  protected systemPrompt: string;
  protected temperature: number;

  constructor(agentType: AgentType, config: Config) {
    const defaults = DEFAULT_AGENT_CONFIG[agentType];
    const overrides = config.agents?.[agentType];

    this.systemPrompt = overrides?.systemPrompt ?? defaults.systemPrompt;
    this.temperature = overrides?.model?.temperature ?? defaults.temperature;

    this.model = createModel({
      provider: config.llm.provider,
      model: overrides?.model?.model ?? config.llm.model ?? defaults.model,
      apiKey: config.llm.apiKey,
      baseUrl: config.llm.baseUrl,
    });
  }
}
