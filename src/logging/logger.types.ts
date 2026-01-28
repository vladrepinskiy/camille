export type LogLevel = "debug" | "info" | "warn" | "error" | "tool";

export interface LogEntry {
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
  timestamp: number;
}
