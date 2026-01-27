import { homedir } from "os";
import { join } from "path";
import { mkdirSync, existsSync } from "fs";

// Data directory - ~/.camille/
const DATA_DIR = join(homedir(), ".camille");

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export const paths = {
  // Root data directory: ~/.camille/
  data(): string {
    ensureDataDir();
    return DATA_DIR;
  },

  // SQLite database path: ~/.camille/camille.db
  db(): string {
    ensureDataDir();
    return join(DATA_DIR, "camille.db");
  },

  // Unix socket path: ~/.camille/camille.sock
  socket(): string {
    ensureDataDir();
    return join(DATA_DIR, "camille.sock");
  },

  // PID file path: ~/.camille/camille.pid
  pid(): string {
    ensureDataDir();
    return join(DATA_DIR, "camille.pid");
  },

  // Config file path: ~/.camille/config.toml
  config(): string {
    ensureDataDir();
    return join(DATA_DIR, "config.toml");
  },

  // Logs directory: ~/.camille/logs/
  logs(): string {
    const logsDir = join(DATA_DIR, "logs");
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
    return logsDir;
  },
};
