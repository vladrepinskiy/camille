import { logger } from "@/logging";
import { paths } from "@/utils/paths.util";
import { existsSync, readFileSync } from "fs";
import { parse as parseToml } from "smol-toml";
import { z } from "zod";

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

export type Config = z.infer<typeof ConfigSchema>;

// Hardcoded defaults - immune to agent corruption.
const DEFAULT_CONFIG: Config = {
  llm: {
    provider: "ollama",
    model: "llama3.2",
  },
};

export function loadConfig(): Config {
  const configPath = paths.config();

  if (!existsSync(configPath)) {
    logger.info("No config file found, using defaults", { path: configPath });
    return DEFAULT_CONFIG;
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const raw = parseToml(content);
    const result = ConfigSchema.safeParse(raw);

    if (!result.success) {
      logger.warn("Config validation failed, using defaults", {
        path: configPath,
        errors: result.error.flatten(),
      });
      return DEFAULT_CONFIG;
    }

    logger.info("Config loaded", { path: configPath });
    return result.data;
  } catch (err) {
    logger.warn("Config parse error, using defaults", {
      path: configPath,
      error: err instanceof Error ? err.message : String(err),
    });
    return DEFAULT_CONFIG;
  }
}

