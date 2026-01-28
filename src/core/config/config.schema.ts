import { z } from "zod";

import type { Config } from "./config.types";

const AgentModelOverrideSchema = z.object({
  model: z.string().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
});

const AgentConfigOverrideSchema = z.object({
  model: AgentModelOverrideSchema.optional(),
  systemPrompt: z.string().optional(),
});

export const ConfigSchema = z.object({
  telegram: z
    .object({
      botToken: z.string().min(1),
    })
    .optional(),
  llm: z.object({
    provider: z.enum(["openai", "ollama"]),
    model: z.string().min(1),
    apiKey: z.string().min(1).optional(),
    baseUrl: z.string().url().optional(),
  }),
  maxToolCalls: z.number().int().min(1).max(20).optional(),
  agents: z
    .object({
      planner: AgentConfigOverrideSchema.optional(),
      synthesizer: AgentConfigOverrideSchema.optional(),
    })
    .optional(),
});

// Hardcoded defaults - immune to agent corruption
export const DEFAULT_CONFIG: Config = {
  llm: {
    provider: "ollama",
    model: "llama3.2",
  },
};
