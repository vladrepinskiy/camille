import { z } from "zod";
import type { Config } from "./config.types";

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
});

// Hardcoded defaults - immune to agent corruption
export const DEFAULT_CONFIG: Config = {
  llm: {
    provider: "ollama",
    model: "llama3.2",
  },
};
