import { runCommand } from "@/utils/command.util";
import { z } from "zod";
import type { Tool, ToolContext } from "./tool.types";

const OSASCRIPT_PATH = "/usr/bin/osascript";
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_OUTPUT_BYTES = 500_000;
const RECORD_SEPARATOR = String.fromCharCode(30);
const FIELD_SEPARATOR = String.fromCharCode(31);
const LIST_CACHE_TTL_MS = 5 * 60 * 1000;

type ListCache = {
  names: string[];
  fetchedAt: number;
};

let listCache: ListCache | null = null;

function getCachedListNames(): string[] | null {
  if (!listCache) return null;
  if (Date.now() - listCache.fetchedAt > LIST_CACHE_TTL_MS) {
    listCache = null;
    return null;
  }

  return listCache.names;
}

function setCachedListNames(names: string[]): void {
  listCache = {
    names,
    fetchedAt: Date.now(),
  };
}

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

const SearchRemindersInputSchema = z
  .object({
    listName: z.string().min(1).describe("Reminders list name to search within"),
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
    query: z.string().min(1).describe("Filter reminder names (case-insensitive substring match)"),
  })
  .strict();

const ListNamesInputSchema = z
  .object({
    refresh: z
      .boolean()
      .optional()
      .describe("Force refresh lists instead of using cached data"),
  })
  .strict();

const CreateReminderInputSchema = z
  .object({
    listName: z.string().min(1).describe("Reminders list name"),
    name: z.string().min(1).describe("Reminder title"),
    notes: z.string().optional().describe("Optional reminder notes"),
  })
  .strict();

const UpdateReminderInputSchema = z
  .object({
    listName: z.string().min(1).describe("Reminders list name"),
    name: z.string().min(1).describe("Existing reminder title"),
    newName: z.string().min(1).optional().describe("New reminder title"),
    completed: z.boolean().optional().describe("Mark reminder completed or active"),
  })
  .strict()
  .refine((value) => value.newName || value.completed !== undefined, {
    message: "Provide at least one of newName or completed",
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

function buildListNamesScript(): string[] {
  return [
    "on run argv",
    `set recordSep to character id ${RECORD_SEPARATOR.charCodeAt(0)}`,
    "tell application \"Reminders\"",
    "set listNames to name of lists",
    "end tell",
    "set AppleScript's text item delimiters to recordSep",
    "return listNames as text",
    "end run",
  ];
}

function buildCreateReminderScript(): string[] {
  return [
    "on run argv",
    `set fieldSep to character id ${FIELD_SEPARATOR.charCodeAt(0)}`,
    "set listName to item 1 of argv",
    "set reminderName to item 2 of argv",
    "set notesText to \"\"",
    "if (count of argv) >= 3 then",
    "set notesText to item 3 of argv",
    "end if",
    "tell application \"Reminders\"",
    "set targetList to list listName",
    "set newReminder to make new reminder at end of targetList with properties {name: reminderName}",
    "if notesText is not \"\" then",
    "set body of newReminder to notesText",
    "end if",
    "set output to (name of targetList) & fieldSep & (name of newReminder) & fieldSep & (id of newReminder as string)",
    "end tell",
    "return output",
    "end run",
  ];
}

function buildUpdateReminderScript(): string[] {
  return [
    "on run argv",
    `set fieldSep to character id ${FIELD_SEPARATOR.charCodeAt(0)}`,
    "set listName to item 1 of argv",
    "set reminderName to item 2 of argv",
    "set newName to \"\"",
    "if (count of argv) >= 3 then",
    "set newName to item 3 of argv",
    "end if",
    "set completedText to \"\"",
    "if (count of argv) >= 4 then",
    "set completedText to item 4 of argv",
    "end if",
    "tell application \"Reminders\"",
    "set targetList to list listName",
    "set matches to (reminders of targetList whose name is reminderName)",
    "set matchCount to (count of matches)",
    "if matchCount is 0 then error \"Reminder not found\"",
    "set targetReminder to item 1 of matches",
    "if newName is not \"\" then",
    "set name of targetReminder to newName",
    "end if",
    "if completedText is \"true\" then",
    "set completed of targetReminder to true",
    "else if completedText is \"false\" then",
    "set completed of targetReminder to false",
    "end if",
    "set output to (name of targetList) & fieldSep & (name of targetReminder) & fieldSep & (completed of targetReminder as string) & fieldSep & (matchCount as string)",
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

function parseListNamesOutput(output: string): string[] {
  if (!output.trim()) {
    return [];
  }

  return output
    .split(RECORD_SEPARATOR)
    .map((name) => name.trim())
    .filter(Boolean);
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

function assertListInCache(listName: string): void {
  const cached = getCachedListNames();
  if (!cached) return;

  if (!cached.includes(listName)) {
    throw new Error(
      `Unknown Reminders list "${listName}". Available lists: ${cached.join(", ")}`
    );
  }
}

async function executeListNames(
  refresh?: boolean
): Promise<{ lists: string[]; fromCache: boolean }> {
  const cached = getCachedListNames();
  if (cached && !refresh) {
    return { lists: cached, fromCache: true };
  }

  const scriptLines = buildListNamesScript();
  const args = scriptLines.flatMap((line) => ["-e", line]);
  const result = await runCommand(OSASCRIPT_PATH, args, {
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxOutputBytes: DEFAULT_MAX_OUTPUT_BYTES,
  });

  if (result.timedOut) {
    throw new Error(`osascript timed out after ${DEFAULT_TIMEOUT_MS}ms`);
  }

  if (result.exitCode !== 0) {
    const errorMessage =
      result.stderr.trim() || result.stdout.trim() || "osascript failed to read Reminders lists";
    throw new Error(errorMessage);
  }

  const lists = parseListNamesOutput(result.stdout);
  setCachedListNames(lists);

  return { lists, fromCache: false };
}

async function executeListReminders(
  parsed: z.infer<typeof ListRemindersInputSchema>
): Promise<unknown> {
  if (parsed.listName) {
    assertListInCache(parsed.listName);
  }

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
  if (!parsed.listName) {
    setCachedListNames(lists.map((list) => list.name));
  }
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

async function executeCreateReminder(
  parsed: z.infer<typeof CreateReminderInputSchema>
): Promise<unknown> {
  assertListInCache(parsed.listName);

  const scriptLines = buildCreateReminderScript();
  const args = scriptLines.flatMap((line) => ["-e", line]);
  const commandArgs = [...args, "--", parsed.listName, parsed.name, parsed.notes ?? ""];

  const result = await runCommand(OSASCRIPT_PATH, commandArgs, {
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxOutputBytes: DEFAULT_MAX_OUTPUT_BYTES,
  });

  if (result.timedOut) {
    throw new Error(`osascript timed out after ${DEFAULT_TIMEOUT_MS}ms`);
  }

  if (result.exitCode !== 0) {
    const errorMessage =
      result.stderr.trim() || result.stdout.trim() || "osascript failed to create reminder";
    throw new Error(errorMessage);
  }

  const [listName, name, id] = result.stdout.split(FIELD_SEPARATOR);

  return {
    listName: listName?.trim() || parsed.listName,
    name: name?.trim() || parsed.name,
    id: id?.trim() || null,
  };
}

async function executeUpdateReminder(
  parsed: z.infer<typeof UpdateReminderInputSchema>
): Promise<unknown> {
  assertListInCache(parsed.listName);

  const scriptLines = buildUpdateReminderScript();
  const args = scriptLines.flatMap((line) => ["-e", line]);
  const completedArg =
    parsed.completed === undefined ? "" : parsed.completed ? "true" : "false";
  const commandArgs = [
    ...args,
    "--",
    parsed.listName,
    parsed.name,
    parsed.newName ?? "",
    completedArg,
  ];

  const result = await runCommand(OSASCRIPT_PATH, commandArgs, {
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxOutputBytes: DEFAULT_MAX_OUTPUT_BYTES,
  });

  if (result.timedOut) {
    throw new Error(`osascript timed out after ${DEFAULT_TIMEOUT_MS}ms`);
  }

  if (result.exitCode !== 0) {
    const errorMessage =
      result.stderr.trim() || result.stdout.trim() || "osascript failed to update reminder";
    throw new Error(errorMessage);
  }

  const parts = result.stdout.split(FIELD_SEPARATOR);
  const listName = parts[0]?.trim() || parsed.listName;
  const name = parts[1]?.trim() || parsed.newName || parsed.name;
  const completed = (parts[2] ?? "").trim().toLowerCase() === "true";
  const matchCount = Number.parseInt((parts[3] ?? "0").trim(), 10);

  return {
    listName,
    name,
    completed,
    matchCount: Number.isNaN(matchCount) ? 0 : matchCount,
  };
}

export const remindersListsTool: Tool = {
  name: "reminders.lists",
  description:
    "List available Apple Reminders lists (cached when possible). Use this when you need a list name.",
  parameters: ListNamesInputSchema,

  async execute(input: unknown, _context: ToolContext): Promise<unknown> {
    const parsed = ListNamesInputSchema.parse(input);
    const result = await executeListNames(parsed.refresh);

    return {
      lists: result.lists,
      cached: result.fromCache,
      count: result.lists.length,
    };
  },
};

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
  description:
    "Search reminders by name within a specific list (read-only). If the user did not specify a list, call reminders.lists and ask them to choose.",
  parameters: SearchRemindersInputSchema,

  async execute(input: unknown, _context: ToolContext): Promise<unknown> {
    const parsed = SearchRemindersInputSchema.parse(input);

    return executeListReminders(parsed);
  },
};

export const remindersCreateTool: Tool = {
  name: "reminders.create",
  description:
    "Create a new reminder in a specific list. If the user did not specify a list, call reminders.lists and ask them to choose.",
  parameters: CreateReminderInputSchema,

  async execute(input: unknown, _context: ToolContext): Promise<unknown> {
    const parsed = CreateReminderInputSchema.parse(input);

    return executeCreateReminder(parsed);
  },
};

export const remindersUpdateTool: Tool = {
  name: "reminders.update",
  description:
    "Update a reminder in a specific list by exact name. If the user did not specify a list, call reminders.lists and ask them to choose.",
  parameters: UpdateReminderInputSchema,

  async execute(input: unknown, _context: ToolContext): Promise<unknown> {
    const parsed = UpdateReminderInputSchema.parse(input);

    return executeUpdateReminder(parsed);
  },
};
