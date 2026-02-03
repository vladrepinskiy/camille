import type { Orchestrator } from "@/core/orchestrator";
import { pairingCodesRepo, sessionsRepo, telegramUsersRepo } from "@/db";
import { logger } from "@/logging";
import { generateSessionId, hashCode } from "@/utils/crypto.util";
import { Bot, type Context } from "grammy";

import { AbstractAdapter } from "../abstract.adapter";

export class TelegramAdapter extends AbstractAdapter {
  readonly name = "telegram";

  private bot: Bot;
  private sessions: Map<number, string> = new Map();

  constructor(orchestrator: Orchestrator, token: string) {
    super(orchestrator);
    this.bot = new Bot(token);
    this.setupHandlers();
  }

  async start(): Promise<void> {
    this.bot.start({
      onStart: (botInfo) => {
        logger.info("Telegram adapter started", { username: botInfo.username });
      },
    });
  }

  async stop(): Promise<void> {
    await this.bot.stop();
    logger.info("Telegram adapter stopped");
  }

  private setupHandlers(): void {
    this.bot.command("start", async (ctx) => {
      await ctx.reply(
        "Welcome to Camille! 🤖\n\n" +
        "To use this bot, you need to pair it with your CLI:\n\n" +
        "1. Run `camille pair` in your terminal\n" +
        "2. Send `/pair YOUR_CODE` here\n\n" +
        "After pairing, you can chat with me!"
      );
    });

    this.bot.command("pair", async (ctx) => {
      const telegramId = ctx.from?.id;
      if (!telegramId) {
        await ctx.reply("Could not identify your Telegram account.");

        return;
      }

      if (telegramUsersRepo.isAuthorized(telegramId)) {
        await ctx.reply("You are already paired! You can start chatting.");

        return;
      }

      const code = ctx.match?.toString().trim().toUpperCase();
      if (!code) {
        await ctx.reply(
          "Please provide a pairing code.\n\n" +
          "Usage: `/pair YOUR_CODE`\n" +
          "Get a code by running `camille pair` in your terminal."
        );

        return;
      }

      const codeHash = hashCode(code);
      const isValid = pairingCodesRepo.validateAndConsume(codeHash);

      if (!isValid) {
        await ctx.reply(
          "Invalid or expired pairing code.\n\n" +
          "Please generate a new code with `camille pair` and try again."
        );

        return;
      }

      try {
        telegramUsersRepo.insert({
          telegram_id: telegramId,
          username: ctx.from?.username || null,
          paired_at: Date.now(),
        });

        logger.info("Telegram user paired", {
          telegramId,
          username: ctx.from?.username,
        });

        await ctx.reply(
          "Successfully paired! 🎉\n\n" + "You can now chat with me. Just send a message!"
        );
      } catch (err) {
        logger.error("Failed to pair Telegram user", { error: err });
        await ctx.reply("Failed to complete pairing. Please try again.");
      }
    });

    this.bot.command("status", async (ctx) => {
      if (!this.isAuthorized(ctx)) {
        await ctx.reply("You are not authorized. Please use /pair first.");

        return;
      }

      await ctx.reply("Camille is running! ✅\n\n" + "Send me a message and I'll respond.");
    });

    this.bot.on("message:text", async (ctx) => {
      if (!this.isAuthorized(ctx)) {
        await ctx.reply(
          "You are not authorized to use this bot.\n\n" +
          "Please pair your account:\n" +
          "1. Run `camille pair` in your terminal\n" +
          "2. Send `/pair YOUR_CODE` here"
        );

        return;
      }

      const telegramId = ctx.from!.id;
      const text = ctx.message.text;

      let sessionId = this.sessions.get(telegramId);
      if (!sessionId) {
        sessionId = generateSessionId();
        this.sessions.set(telegramId, sessionId);
      }
      sessionsRepo.ensure(sessionId, "telegram", String(telegramId));

      logger.debug("Telegram message received", {
        telegramId,
        text: text.slice(0, 100),
      });

      try {
        // Send initial typing indicator
        await ctx.replyWithChatAction("typing");

        // Track status for potential status message updates
        let statusMessageId: number | undefined;
        let lastStatus = "";

        const response = await this.orchestrator.processMessage(text, sessionId, {
          onStatus: async (status) => {
            let statusText = "";
            if (status.type === "planning") {
              statusText = "Thinking...";
            } else if (status.type === "executing_tool") {
              statusText = `Running ${status.tool}...`;
            } else if (status.type === "synthesizing") {
              statusText = "Writing response...";
            }

            // Only update if status changed
            if (statusText && statusText !== lastStatus) {
              lastStatus = statusText;
              try {
                if (statusMessageId) {
                  await ctx.api.editMessageText(
                    ctx.chat!.id,
                    statusMessageId,
                    statusText
                  );
                } else {
                  const msg = await ctx.reply(statusText);
                  statusMessageId = msg.message_id;
                }
              } catch {
                // Ignore edit errors (message might be deleted)
              }
            }
          },
        });

        // Delete status message if it exists
        if (statusMessageId) {
          try {
            await ctx.api.deleteMessage(ctx.chat!.id, statusMessageId);
          } catch {
            // Ignore delete errors
          }
        }

        const maxLength = 4096;
        const responseText = response.text;

        if (responseText.length <= maxLength) {
          await ctx.reply(responseText);
        } else {
          for (let i = 0; i < responseText.length; i += maxLength) {
            await ctx.reply(responseText.slice(i, i + maxLength));
          }
        }
      } catch (err) {
        logger.error("Failed to process Telegram message", { error: err });
        await ctx.reply("Sorry, something went wrong. Please try again.");
      }
    });
  }

  private isAuthorized(ctx: Context): boolean {
    const telegramId = ctx.from?.id;
    if (!telegramId) return false;

    return telegramUsersRepo.isAuthorized(telegramId);
  }
}
