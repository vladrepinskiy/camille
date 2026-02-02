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
    status: z
      .enum(["active", "completed", "all"])
      .default("active")
      .describe("Filter by status: active, completed, or all"),
    maxResults: z
      .number()
      .int()
      .positive()
      .max(2_000)
      .optional()
      .describe("Limit total reminders returned across lists"),
    query: z
      .string()
      .min(1)
      .optional()
      .describe("Filter reminder names (case-insensitive substring match)"),
  })
  .strict();

const SearchRemindersInputSchema = ListRemindersInputSchema.extend({
  query: z.string().min(1).describe("Filter reminder names (case-insensitive substring match)"),
});

function buildListRemindersScript(): string[] {
  return [
    "on run argv",
    `set recordSep to character id ${RECORD_SEPARATOR.charCodeAt(0)}`,
    `set fieldSep to character id ${FIELD_SEPARATOR.charCodeAt(0)}`,
    "set targetListName to \"\"",
    "if (count of argv) >= 1 then",
    "set targetListName to item 1 of argv",
    "end if",
    "set statusFilter to \"active\"",
    "if (count of argv) >= 2 then",
    "set statusFilter to item 2 of argv",
    "end if",
    "if statusFilter is not \"active\" and statusFilter is not \"completed\" and statusFilter is not \"all\" then",
    "set statusFilter to \"active\"",
    "end if",
    "set maxResults to 0",
    "if (count of argv) >= 3 then",
    "try",
    "set maxResults to (item 3 of argv) as integer",
    "on error",
    "set maxResults to 0",
    "end try",
    "end if",
    "set hasLimit to maxResults > 0",
    "set totalCount to 0",
    "set shouldStop to false",
    "tell application \"Reminders\"",
    "set targetLists to lists",
    "if targetListName is not \"\" then",
    "set targetLists to {list targetListName}",
    "end if",
    "set output to \"\"",
    "repeat with L in targetLists",
    "if shouldStop then exit repeat",
    "set listName to name of L",
    "set output to output & \"LIST\" & fieldSep & listName & recordSep",
    "if statusFilter is \"completed\" then",
    "set listReminders to reminders of L whose completed is true",
    "else if statusFilter is \"active\" then",
    "set listReminders to reminders of L whose completed is false",
    "else",
    "set listReminders to reminders of L",
    "end if",
    "repeat with R in listReminders",
    "set isCompleted to (completed of R)",
    "set output to output & \"REM\" & fieldSep & listName & fieldSep & (name of R) & fieldSep & (isCompleted as string) & recordSep",
    "set totalCount to totalCount + 1",
    "if hasLimit and totalCount >= maxResults then",
    "set shouldStop to true",
    "exit repeat",
    "end if",
    "end repeat",
    "end repeat",
    "end tell",
    "return output",
    "end run",
  ];
}

type ReminderItem = {
  name: string;
  completed: boolean;
};

type ReminderList = {
  name: string;
  reminders: ReminderItem[];
};

function parseRemindersOutput(output: string): ReminderList[] {
  if (!output.trim()) {
    return [];
  }

  const records = output.split(RECORD_SEPARATOR).filter(Boolean);
  const listOrder: string[] = [];
  const lists = new Map<string, ReminderList>();

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
      const completedRaw = (parts[3] ?? "").toLowerCase();
      const completed = completedRaw === "true";
      if (!lists.has(listName)) {
        lists.set(listName, { name: listName, reminders: [] });
        listOrder.push(listName);
      }

      if (reminderName) {
        lists.get(listName)?.reminders.push({ name: reminderName, completed });
      }
    }
  }

  return listOrder.map((name) => lists.get(name)!).filter(Boolean);
}

function filterLists(lists: ReminderList[], query?: string): ReminderList[] {
  const needle = query?.toLowerCase().trim();
  const filtered = lists.map((list) => {
    let reminders = list.reminders;

    if (needle) {
      reminders = reminders.filter((r) => r.name.toLowerCase().includes(needle));
    }

    return { ...list, reminders };
  });

  return filtered;
}

async function executeListReminders(
  parsed: z.infer<typeof ListRemindersInputSchema>
): Promise<unknown> {
  const status = parsed.status;
  const scriptLines = buildListRemindersScript();
  const args = scriptLines.flatMap((line) => ["-e", line]);
  const listArg = parsed.listName ?? "";
  const statusArg = status;
  const maxResultsArg = parsed.maxResults ? String(parsed.maxResults) : "";
  const commandArgs = [...args, "--", listArg, statusArg, maxResultsArg];

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

  const lists = filterLists(parseRemindersOutput(result.stdout), parsed.query);
  const totalCount = lists.reduce((sum, list) => sum + list.reminders.length, 0);
  const limitReached = parsed.maxResults ? totalCount >= parsed.maxResults : false;

  return {
    lists,
    status,
    query: parsed.query ?? null,
    filteredList: parsed.listName ?? null,
    maxResults: parsed.maxResults ?? null,
    limitReached,
    truncated: result.truncated,
  };
}

export const remindersListTool: Tool = {
  name: "reminders.list",
  description: "List reminders from Apple Reminders with optional status and name filters (read-only)",
  parameters: ListRemindersInputSchema,

  async execute(input: unknown, _context: ToolContext): Promise<unknown> {
    const parsed = ListRemindersInputSchema.parse(input);

    return executeListReminders(parsed);
  },
};

export const remindersSearchTool: Tool = {
  name: "reminders.search",
  description: "Search reminders by name with optional status and list filters (read-only)",
  parameters: SearchRemindersInputSchema,

  async execute(input: unknown, _context: ToolContext): Promise<unknown> {
    const parsed = SearchRemindersInputSchema.parse(input);

    return executeListReminders(parsed);
  },
};
