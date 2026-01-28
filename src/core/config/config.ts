import { logger } from "@/logging";
import { paths } from "@/utils/paths.util";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import { ConfigSchema, DEFAULT_CONFIG } from "./config.schema";
import type { Config } from "./config.types";

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

export function writeConfig(config: Config): void {
  const configPath = paths.config();
  const configDir = dirname(configPath);

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  const toml = stringifyToml(config);
  writeFileSync(configPath, toml, "utf-8");
}
