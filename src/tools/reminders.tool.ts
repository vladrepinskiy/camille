import { runCommand } from "@/utils/command.util";
import { z } from "zod";
import type { Tool, ToolContext } from "./tool.types";

const OSASCRIPT_PATH = "/usr/bin/osascript";
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_OUTPUT_BYTES = 500_000;
const RECORD_SEPARATOR = String.fromCharCode(30);
const FIELD_SEPARATOR = String.fromCharCode(31);

const ListRemindersInputSchema = z
  .object({
    listName: z.string().min(1).optional().describe("Optional Reminders list name to filter by"),
    includeCompleted: z
      .boolean()
      .default(false)
      .describe("Include completed reminders in the results"),
  })
  .strict();

function buildListRemindersScript(): string[] {
  return [
    "on run argv",
    `set recordSep to character id ${RECORD_SEPARATOR.charCodeAt(0)}`,
    `set fieldSep to character id ${FIELD_SEPARATOR.charCodeAt(0)}`,
    "set targetListName to \"\"",
    "if (count of argv) >= 1 then",
    "set targetListName to item 1 of argv",
    "end if",
    "set includeCompleted to false",
    "if (count of argv) >= 2 then",
    "set includeCompleted to (item 2 of argv) is \"true\"",
    "end if",
    "tell application \"Reminders\"",
    "set targetLists to lists",
    "if targetListName is not \"\" then",
    "set targetLists to {list targetListName}",
    "end if",
    "set output to \"\"",
    "repeat with L in targetLists",
    "set listName to name of L",
    "set output to output & \"LIST\" & fieldSep & listName & recordSep",
    "repeat with R in reminders of L",
    "if includeCompleted or (completed of R is false) then",
    "set output to output & \"REM\" & fieldSep & listName & fieldSep & (name of R) & recordSep",
    "end if",
    "end repeat",
    "end repeat",
    "end tell",
    "return output",
    "end run",
  ];
}

function parseRemindersOutput(output: string): Array<{ name: string; reminders: string[] }> {
  if (!output.trim()) {
    return [];
  }

  const records = output.split(RECORD_SEPARATOR).filter(Boolean);
  const listOrder: string[] = [];
  const lists = new Map<string, { name: string; reminders: string[] }>();

  for (const record of records) {
    const parts = record.split(FIELD_SEPARATOR);
    const kind = parts[0];

    if (kind === "LIST") {
      const listName = parts[1] ?? "";
      if (!lists.has(listName)) {
        lists.set(listName, { name: listName, reminders: [] });
        listOrder.push(listName);
      }
      continue;
    }

    if (kind === "REM") {
      const listName = parts[1] ?? "";
      const reminderName = parts[2] ?? "";
      if (!lists.has(listName)) {
        lists.set(listName, { name: listName, reminders: [] });
        listOrder.push(listName);
      }

      if (reminderName) {
        lists.get(listName)?.reminders.push(reminderName);
      }
    }
  }

  return listOrder.map((name) => lists.get(name)!).filter(Boolean);
}

export const remindersListTool: Tool = {
  name: "reminders.list",
  description: "List reminders from Apple Reminders via AppleScript (read-only)",
  parameters: ListRemindersInputSchema,

  async execute(input: unknown, _context: ToolContext): Promise<unknown> {
    const parsed = ListRemindersInputSchema.parse(input);
    const scriptLines = buildListRemindersScript();
    const args = scriptLines.flatMap((line) => ["-e", line]);
    const listArg = parsed.listName ?? "";
    const includeArg = parsed.includeCompleted ? "true" : "false";
    const commandArgs = [...args, "--", listArg, includeArg];

    const result = await runCommand(OSASCRIPT_PATH, commandArgs, {
      timeoutMs: DEFAULT_TIMEOUT_MS,
      maxOutputBytes: DEFAULT_MAX_OUTPUT_BYTES,
    });

    if (result.timedOut) {
      throw new Error(`osascript timed out after ${DEFAULT_TIMEOUT_MS}ms`);
    }

    if (result.exitCode !== 0) {
      const errorMessage =
        result.stderr.trim() || result.stdout.trim() || "osascript failed to read Reminders";
      throw new Error(errorMessage);
    }

    return {
      lists: parseRemindersOutput(result.stdout),
      includeCompleted: parsed.includeCompleted,
      filteredList: parsed.listName ?? null,
      truncated: result.truncated,
    };
  },
};
