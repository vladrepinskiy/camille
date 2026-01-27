#!/usr/bin/env node

import { IPCClient } from "@/clients/ipc/client";
import { allowedPathsRepo, pairingCodesRepo } from "@/db";
import { generatePairingCode, hashCode } from "@/utils/crypto.util";
import { paths } from "@/utils/paths.util";
import { spawn } from "child_process";
import { Command } from "commander";
import { existsSync, readFileSync, rmSync, unlinkSync } from "fs";
import { connect } from "net";
import { join, resolve } from "path";
import { createInterface } from "readline";

const program = new Command();

const pkg = JSON.parse(
  readFileSync(join(__dirname, "../package.json"), "utf-8")
);

program
  .name(pkg.name || "camille")
  .description(pkg.description || "A tools-enabled, local-first AI personal assistant")
  .version(pkg.version || "x.y.z");

program
  .command("start")
  .description("Start the Camille daemon")
  .option("-f, --foreground", "Run in foreground (don't daemonize)")
  .action(async (options) => {
    const pidPath = paths.pid();

    if (existsSync(pidPath)) {
      const pid = parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
      try {
        process.kill(pid, 0);
        console.error(`Camille is already running (PID: ${pid})`);
        process.exit(1);
      } catch {
        unlinkSync(pidPath);
      }
    }

    if (options.foreground) {
      const { Runtime } = await import("@/core/runtime");
      const runtime = new Runtime();

      process.on("SIGINT", () => runtime.shutdown());
      process.on("SIGTERM", () => runtime.shutdown());

      await runtime.start();
    } else {
      const child = spawn(process.execPath, [new URL(import.meta.url).pathname, "start", "-f"], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      console.log(`Camille started (PID: ${child.pid})`);
    }
  });

program
  .command("stop")
  .description("Stop the Camille daemon")
  .action(() => {
    const pidPath = paths.pid();

    if (!existsSync(pidPath)) {
      console.error("Camille is not running");
      process.exit(1);
    }

    const pid = parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
    try {
      process.kill(pid, "SIGTERM");
      console.log(`Sent shutdown signal to Camille (PID: ${pid})`);
    } catch (err) {
      console.error(`Failed to stop Camille: ${err}`);
      process.exit(1);
    }
  });

program
  .command("status")
  .description("Check if Camille is running")
  .action(() => {
    const pidPath = paths.pid();
    const sockPath = paths.socket();

    if (!existsSync(pidPath)) {
      console.log("Camille is not running");
      process.exit(1);
    }

    const pid = parseInt(readFileSync(pidPath, "utf-8").trim(), 10);

    try {
      process.kill(pid, 0);
    } catch {
      console.log("Camille is not running (stale PID file)");
      process.exit(1);
    }

    const socket = connect(sockPath);
    socket.on("connect", () => {
      console.log(`Camille is running (PID: ${pid})`);
      socket.end();
      process.exit(0);
    });
    socket.on("error", () => {
      console.log(`Camille process exists (PID: ${pid}) but socket not responding`);
      process.exit(1);
    });
  });

program
  .command("chat")
  .description("Start an interactive chat session")
  .action(async () => {
    const client = new IPCClient();

    try {
      await client.connect();
    } catch {
      console.error("Failed to connect to Camille. Is it running?");
      process.exit(1);
    }

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "you> ",
    });

    console.log("Connected to Camille. Type 'exit' to quit.\n");
    rl.prompt();

    rl.on("line", async (line) => {
      const input = line.trim();

      if (input === "exit" || input === "quit") {
        rl.close();
        client.disconnect();
        process.exit(0);
      }

      if (!input) {
        rl.prompt();

        return;
      }

      try {
        process.stdout.write("camille> ");
        await client.sendMessage(input, (chunk) => {
          process.stdout.write(chunk);
        });
        process.stdout.write("\n\n");
      } catch (err) {
        console.error(`\nError: ${err}`);
      }

      rl.prompt();
    });

    rl.on("close", () => {
      client.disconnect();
      process.exit(0);
    });
  });

program
  .command("pair")
  .description("Generate a pairing code for Telegram")
  .action(() => {
    const code = generatePairingCode();
    const hash = hashCode(code);
    const expiresAt = Date.now() + 5 * 60 * 1000;

    pairingCodesRepo.insert(hash, expiresAt);

    console.log(`Your pairing code: ${code}`);
    console.log("Send /pair " + code + " to the Telegram bot within 5 minutes.");
  });

program
  .command("allow <path>")
  .description("Whitelist a directory for read access")
  .action((dirPath) => {
    const absolutePath = resolve(dirPath);

    try {
      allowedPathsRepo.insert(absolutePath, "read");
      console.log(`Allowed read access to: ${absolutePath}`);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("UNIQUE constraint")) {
        console.log(`Path already whitelisted: ${absolutePath}`);
      } else {
        throw err;
      }
    }
  });

program
  .command("disallow <path>")
  .description("Remove a directory from the whitelist")
  .action((dirPath) => {
    const absolutePath = resolve(dirPath);
    const deleted = allowedPathsRepo.delete(absolutePath);

    if (deleted) {
      console.log(`Removed from whitelist: ${absolutePath}`);
    } else {
      console.log(`Path was not in whitelist: ${absolutePath}`);
    }
  });

program
  .command("paths")
  .description("List all whitelisted paths")
  .action(() => {
    const rows = allowedPathsRepo.findAll();

    if (rows.length === 0) {
      console.log("No paths whitelisted.");
      console.log("Use 'camille allow <path>' to whitelist a directory.");

      return;
    }

    console.log("Whitelisted paths:\n");
    for (const row of rows) {
      const date = new Date(row.added_at).toLocaleString();
      console.log(`  ${row.path}`);
      console.log(`    permissions: ${row.permissions}, added: ${date}\n`);
    }
  });

program
  .command("reset")
  .description("Wipe agent memory and data (keeps config by default)")
  .option("--all", "Also delete config file")
  .option("-y, --yes", "Skip confirmation prompt")
  .action(async (options) => {
    const dataDir = paths.data();

    if (!existsSync(dataDir)) {
      console.log("Nothing to reset (data directory doesn't exist)");

      return;
    }

    const pidPath = paths.pid();
    if (existsSync(pidPath)) {
      const pid = parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
      try {
        process.kill(pid, 0);
        console.log(`Stopping Camille daemon (PID: ${pid})...`);
        process.kill(pid, "SIGTERM");
        await new Promise((r) => setTimeout(r, 1000));
      } catch {
        // Process doesn't exist
      }
    }

    if (!options.yes) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise<string>((resolve) => {
        rl.question(
          `This will delete all data in ${dataDir}${options.all ? " including config" : " (keeping config)"}. Continue? [y/N] `,
          resolve
        );
      });
      rl.close();

      if (answer.toLowerCase() !== "y") {
        console.log("Aborted");

        return;
      }
    }

    const filesToDelete = [
      "camille.db",
      "camille.db-wal",
      "camille.db-shm",
      "camille.sock",
      "camille.pid",
    ];

    if (options.all) {
      filesToDelete.push("config.toml");
    }

    let deleted = 0;
    for (const file of filesToDelete) {
      const filePath = join(dataDir, file);
      if (existsSync(filePath)) {
        try {
          unlinkSync(filePath);
          console.log(`  Deleted: ${file}`);
          deleted++;
        } catch (err) {
          console.error(`  Failed to delete ${file}: ${err}`);
        }
      }
    }

    const logsDir = join(dataDir, "logs");
    if (existsSync(logsDir)) {
      try {
        rmSync(logsDir, { recursive: true });
        console.log(`  Deleted: logs/`);
        deleted++;
      } catch (err) {
        console.error(`  Failed to delete logs/: ${err}`);
      }
    }

    if (deleted === 0) {
      console.log("Nothing to delete");
    } else {
      console.log(`\nReset complete. Deleted ${deleted} item(s).`);
      if (!options.all && existsSync(paths.config())) {
        console.log(`Config preserved at: ${paths.config()}`);
      }
    }
  });

program.parse();
