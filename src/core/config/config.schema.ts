import { z } from "zod";

import type { Config } from "./config.types";

const AgentModelOverrideSchema = z.object({
  model: z.string().min(1).optional(),
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

// TODO [VR]: get these from DEFAULT_AGENT_CONFIG to avoid duplication
export const DEFAULT_CONFIG: Config = {
  llm: {
    provider: "ollama",
    model: "qwen2.5:14b-instruct-q4_K_M",
  },
};
