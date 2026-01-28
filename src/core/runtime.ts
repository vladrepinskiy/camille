import type { AbstractAdapter } from "@/adapters/abstract.adapter";
import { IPCAdapter } from "@/adapters/ipc/ipc.adapter";
import { TelegramAdapter } from "@/adapters/telegram/telegram.adapter";
import { loadConfig, type Config } from "@/core/config";
import { Orchestrator } from "@/core/orchestrator";
import { closeDb, getDb } from "@/db";
import { isLLMConfigured } from "@/llm";
import { logger } from "@/logging";
import { paths } from "@/utils/paths.util";
import { existsSync, unlinkSync, writeFileSync } from "fs";

export class Runtime {
  private config: Config | null = null;
  private orchestrator: Orchestrator | null = null;
  private adapters: AbstractAdapter[] = [];
  private isShuttingDown = false;

  async start(): Promise<void> {
    logger.info("Starting Camille daemon", { pid: process.pid });

    this.writePidFile();

    const db = getDb();
    logger.setDatabase(db);
    logger.info("Database initialized", { path: paths.db() });

    this.config = loadConfig();
    logger.info("Configuration loaded", {
      provider: this.config.llm.provider,
      model: this.config.llm.model,
    });

    // Verify LLM is configured
    const llmConfigured = isLLMConfigured({
      provider: this.config.llm.provider,
      model: this.config.llm.model,
      apiKey: this.config.llm.apiKey,
    });

    if (!llmConfigured) {
      logger.error("LLM not configured. Run 'camille configure' to set up.");
      throw new Error(
        "LLM not configured. Please run 'camille configure' to set up your API key."
      );
    }

    this.orchestrator = new Orchestrator(this.config);
    logger.info("Orchestrator initialized", {
      provider: this.config.llm.provider,
      model: this.config.llm.model,
    });

    this.adapters.push(new IPCAdapter(this.orchestrator));

    if (this.config.telegram?.botToken) {
      this.adapters.push(
        new TelegramAdapter(this.orchestrator, this.config.telegram.botToken)
      );
    } else {
      logger.info("Telegram adapter not configured (no botToken in config)");
    }

    await Promise.all(this.adapters.map((a) => a.start()));

    logger.info("Camille is ready");

    await this.keepAlive();
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;

    logger.info("Shutting down Camille daemon");

    await Promise.all(this.adapters.map((a) => a.stop()));

    closeDb();
    logger.info("Database closed");

    this.removePidFile();

    logger.info("Camille shutdown complete");
    process.exit(0);
  }

  private writePidFile(): void {
    const pidPath = paths.pid();
    writeFileSync(pidPath, process.pid.toString());
  }

  private removePidFile(): void {
    const pidPath = paths.pid();
    if (existsSync(pidPath)) {
      try {
        unlinkSync(pidPath);
      } catch (err) {
        logger.warn("Failed to remove PID file", { error: err });
      }
    }
  }

  private async keepAlive(): Promise<void> {
    return new Promise(() => {
      // Never resolves - shutdown via signals
    });
  }
}
