import type { LogLevel } from "./logger.types";

export const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
} as const;

export const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: ANSI.dim,
  info: ANSI.blue,
  warn: ANSI.yellow,
  error: ANSI.red,
  tool: ANSI.cyan,
};

export const LEVEL_LABELS: Record<LogLevel, string> = {
  debug: "DEBUG",
  info: "INFO ",
  warn: "WARN ",
  error: "ERROR",
  tool: "TOOL ",
};
