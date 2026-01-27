import type { Database } from "better-sqlite3";
import { ANSI, LEVEL_COLORS, LEVEL_LABELS } from "./logger.constants";
import type { LogEntry, LogLevel } from "./logger.types";

class Logger {
  private db: Database | null = null;
  private minLevel: LogLevel = "debug";

  setDatabase(db: Database): void {
    this.db = db;
  }

  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error", "tool"];

    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private formatTime(timestamp: number): string {
    const date = new Date(timestamp);

    return date.toISOString().slice(11, 23);
  }

  private formatMeta(meta?: Record<string, unknown>): string {
    if (!meta || Object.keys(meta).length === 0) return "";

    try {
      return ` ${ANSI.dim}${JSON.stringify(meta)}${ANSI.reset}`;
    } catch {
      return "";
    }
  }

  private log(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    const color = LEVEL_COLORS[entry.level];
    const label = LEVEL_LABELS[entry.level];
    const time = this.formatTime(entry.timestamp);
    const metaStr = this.formatMeta(entry.meta);

    console.log(
      `${ANSI.dim}${time}${ANSI.reset} ${color}${label}${ANSI.reset} ${entry.message}${metaStr}`
    );

    if (this.db) {
      try {
        this.db
          .prepare("INSERT INTO logs (level, message, meta, created_at) VALUES (?, ?, ?, ?)")
          .run(
            entry.level,
            entry.message,
            entry.meta ? JSON.stringify(entry.meta) : null,
            entry.timestamp
          );
      } catch {
        // Don't let logging failures crash the app
      }
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log({ level: "debug", message, meta, timestamp: Date.now() });
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log({ level: "info", message, meta, timestamp: Date.now() });
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log({ level: "warn", message, meta, timestamp: Date.now() });
  }

  error(message: string | Error, meta?: Record<string, unknown>): void {
    if (message instanceof Error) {
      this.log({
        level: "error",
        message: message.message,
        meta: { ...meta, stack: message.stack },
        timestamp: Date.now(),
      });
    } else {
      this.log({ level: "error", message, meta, timestamp: Date.now() });
    }
  }

  tool(toolName: string, meta?: Record<string, unknown>): void {
    this.log({
      level: "tool",
      message: `tool:${toolName}`,
      meta,
      timestamp: Date.now(),
    });
  }
}

export const logger = new Logger();
