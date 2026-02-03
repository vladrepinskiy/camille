import { runCommand } from "@/utils/command.util";
import { z } from "zod";
import type { Tool, ToolContext } from "./tool.types";

const ALLOWED_COMMANDS = {
  osascript: "/usr/bin/osascript",
} as const;

type AllowedCommand = keyof typeof ALLOWED_COMMANDS;

const CommandInputSchema = z
  .object({
    command: z.enum(["osascript"]).describe("Allowlisted command name"),
    args: z
      .array(z.string().max(2_000))
      .max(50)
      .default([])
      .describe("Command arguments"),
    timeoutMs: z
      .number()
      .int()
      .positive()
      .max(5_000)
      .optional()
      .describe("Timeout in milliseconds (max 5000)"),
  })
  .strict();

const MAX_SCRIPT_LENGTH = 4_000;

function extractOsascriptScript(args: string[]): { script: string; hasScript: boolean } {
  const lines: string[] = [];
  let i = 0;
  let inArgv = false;

  while (i < args.length) {
    const arg = args[i];

    if (!inArgv && arg === "--") {
      inArgv = true;
      i += 1;
      continue;
    }

    if (!inArgv) {
      if (arg !== "-e") {
        throw new Error(`Unsupported osascript flag: ${arg}`);
      }

      const line = args[i + 1];
      if (!line) {
        throw new Error("Missing script line after -e");
      }

      lines.push(line);
      i += 2;
      continue;
    }

    i += 1;
  }

  return { script: lines.join("\n"), hasScript: lines.length > 0 };
}

function assertSafeOsascript(args: string[]): void {
  const { script, hasScript } = extractOsascriptScript(args);

  if (!hasScript) {
    throw new Error("osascript requires at least one -e script line");
  }

  if (script.length > MAX_SCRIPT_LENGTH) {
    throw new Error(`osascript script exceeds ${MAX_SCRIPT_LENGTH} characters`);
  }

  const lowerScript = script.toLowerCase();

  if (lowerScript.includes("do shell script")) {
    throw new Error("osascript scripts cannot use 'do shell script' in safe mode");
  }

  if (!/tell\s+(application|app)\s+\"reminders\"/i.test(script)) {
    throw new Error("osascript scripts must target the Reminders app in safe mode");
  }
}

export const commandTool: Tool = {
  name: "command",
  description:
    "Run a tightly allowlisted command without a shell (safe mode; currently only osascript for Reminders)",
  parameters: CommandInputSchema,

  async execute(input: unknown, _context: ToolContext): Promise<unknown> {
    const parsed = CommandInputSchema.parse(input);
    const command = parsed.command as AllowedCommand;
    const commandPath = ALLOWED_COMMANDS[command];

    if (command === "osascript") {
      assertSafeOsascript(parsed.args);
    }

    const result = await runCommand(commandPath, parsed.args, {
      timeoutMs: parsed.timeoutMs,
    });

    return {
      command: parsed.command,
      args: parsed.args,
      exitCode: result.exitCode,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
      timedOut: result.timedOut,
      truncated: result.truncated,
      success: result.exitCode === 0 && !result.timedOut,
    };
  },
};
