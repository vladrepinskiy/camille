import { runCommand } from "@/utils/command.util";
import { z } from "zod";
import type { Tool, ToolContext } from "./tool.types";

const OSASCRIPT_PATH = "/usr/bin/osascript";
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_OUTPUT_BYTES = 500_000;
const RECORD_SEPARATOR = String.fromCharCode(30);
const FIELD_SEPARATOR = String.fromCharCode(31);
const LIST_CACHE_TTL_MS = 5 * 60 * 1000;

type CalendarListCache = {
  names: string[];
  fetchedAt: number;
};

let calendarCache: CalendarListCache | null = null;

function getCachedCalendarNames(): string[] | null {
  if (!calendarCache) return null;
  if (Date.now() - calendarCache.fetchedAt > LIST_CACHE_TTL_MS) {
    calendarCache = null;

    return null;
  }

  return calendarCache.names;
}

function setCachedCalendarNames(names: string[]): void {
  calendarCache = {
    names,
    fetchedAt: Date.now(),
  };
}

const ListCalendarsInputSchema = z
  .object({
    refresh: z
      .boolean()
      .optional()
      .describe("Force refresh calendars instead of using cached data"),
  })
  .strict();

const ListByDayInputSchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
      .describe("Date in YYYY-MM-DD (local time)"),
    calendars: z
      .array(z.string().min(1))
      .min(1)
      .optional()
      .describe("Optional calendar names to filter by"),
    maxResults: z
      .number()
      .int()
      .positive()
      .max(2_000)
      .optional()
      .describe("Limit total events returned across calendars"),
  })
  .strict();

const WeekEventsInputSchema = z
  .object({
    weekStartsOn: z
      .enum(["monday", "sunday"])
      .default("monday")
      .describe("Week start day for the range"),
    calendars: z
      .array(z.string().min(1))
      .min(1)
      .optional()
      .describe("Optional calendar names to filter by"),
    maxResults: z
      .number()
      .int()
      .positive()
      .max(2_000)
      .optional()
      .describe("Limit total events returned across calendars"),
  })
  .strict();

type CalendarEvent = {
  calendar: string;
  title: string;
  startEpoch: number;
  endEpoch: number;
  allDay: boolean;
};

type CalendarDay = {
  date: string;
  events: {
    calendar: string;
    title: string;
    start: string;
    end: string;
    allDay: boolean;
  }[];
};

function buildListCalendarsScript(): string[] {
  return [
    "on run argv",
    `set recordSep to character id ${RECORD_SEPARATOR.charCodeAt(0)}`,
    "tell application \"Calendar\"",
    "set calendarNames to name of calendars",
    "end tell",
    "set AppleScript's text item delimiters to recordSep",
    "return calendarNames as text",
    "end run",
  ];
}

function buildListEventsScript(): string[] {
  return [
    "on run argv",
    `set recordSep to character id ${RECORD_SEPARATOR.charCodeAt(0)}`,
    `set fieldSep to character id ${FIELD_SEPARATOR.charCodeAt(0)}`,
    "set startSeconds to (item 1 of argv) as integer",
    "set endSeconds to (item 2 of argv) as integer",
    "set calendarArg to \"\"",
    "if (count of argv) >= 3 then",
    "set calendarArg to item 3 of argv",
    "end if",
    "set maxResults to 0",
    "if (count of argv) >= 4 then",
    "try",
    "set maxResults to (item 4 of argv) as integer",
    "on error",
    "set maxResults to 0",
    "end try",
    "end if",
    "set hasLimit to maxResults > 0",
    "set totalCount to 0",
    "set shouldStop to false",
    "set epochDate to (current date)",
    "set year of epochDate to 1970",
    "set month of epochDate to January",
    "set day of epochDate to 1",
    "set time of epochDate to 0",
    "set startDate to epochDate + startSeconds",
    "set endDate to epochDate + endSeconds",
    "set calendarNames to {}",
    "if calendarArg is not \"\" then",
    "set AppleScript's text item delimiters to recordSep",
    "set calendarNames to text items of calendarArg",
    "set AppleScript's text item delimiters to \"\"",
    "end if",
    "set output to \"\"",
    "tell application \"Calendar\"",
    "if calendarArg is \"\" then",
    "set targetCalendars to calendars",
    "else",
    "set targetCalendars to {}",
    "repeat with C in calendarNames",
    "try",
    "set end of targetCalendars to calendar (C as string)",
    "end try",
    "end repeat",
    "end if",
    "repeat with Cal in targetCalendars",
    "if shouldStop then exit repeat",
    "set calName to name of Cal",
    "set matchingEvents to (events of Cal whose start date < endDate and end date > startDate)",
    "repeat with E in matchingEvents",
    "set eventTitle to summary of E",
    "set eventStart to start date of E",
    "set eventEnd to end date of E",
    "set allDayFlag to false",
    "try",
    "set allDayFlag to |all day event| of E",
    "on error",
    "set allDayFlag to false",
    "end try",
    "set startEpoch to (eventStart - epochDate)",
    "set endEpoch to (eventEnd - epochDate)",
    "set output to output & \"EVT\" & fieldSep & calName & fieldSep & eventTitle & fieldSep & (startEpoch as string) & fieldSep & (endEpoch as string) & fieldSep & (allDayFlag as string) & recordSep",
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

function parseCalendarListOutput(output: string): string[] {
  if (!output.trim()) {
    return [];
  }

  return output
    .split(RECORD_SEPARATOR)
    .map((name) => name.trim())
    .filter(Boolean);
}

function parseEventsOutput(output: string): CalendarEvent[] {
  if (!output.trim()) {
    return [];
  }

  const records = output.split(RECORD_SEPARATOR).filter(Boolean);
  const events: CalendarEvent[] = [];

  for (const record of records) {
    const parts = record.split(FIELD_SEPARATOR);
    if (parts[0] !== "EVT") continue;

    const calendar = (parts[1] ?? "").trim();
    const title = (parts[2] ?? "").trim();
    const startEpoch = Number.parseInt((parts[3] ?? "0").trim(), 10);
    const endEpoch = Number.parseInt((parts[4] ?? "0").trim(), 10);
    const allDay = (parts[5] ?? "").trim().toLowerCase() === "true";
    if (!calendar || Number.isNaN(startEpoch) || Number.isNaN(endEpoch)) {
      continue;
    }

    events.push({
      calendar,
      title,
      startEpoch,
      endEpoch,
      allDay,
    });
  }

  return events;
}

function parseDateOnly(input: string): Date {
  const [yearRaw, monthRaw, dayRaw] = input.split("-");
  const year = Number.parseInt(yearRaw ?? "", 10);
  const month = Number.parseInt(monthRaw ?? "", 10);
  const day = Number.parseInt(dayRaw ?? "", 10);

  if (!year || !month || !day) {
    throw new Error("Invalid date: use YYYY-MM-DD");
  }

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error("Invalid date: use YYYY-MM-DD");
  }

  date.setHours(0, 0, 0, 0);

  return date;
}

function toEpochSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function groupEventsByDay(events: CalendarEvent[]): CalendarDay[] {
  const days = new Map<string, CalendarDay>();

  for (const event of events) {
    const startDate = new Date(event.startEpoch * 1000);
    const dayKey = toDateKey(startDate);
    if (!days.has(dayKey)) {
      days.set(dayKey, { date: dayKey, events: [] });
    }

    days.get(dayKey)?.events.push({
      calendar: event.calendar,
      title: event.title,
      start: startDate.toISOString(),
      end: new Date(event.endEpoch * 1000).toISOString(),
      allDay: event.allDay,
    });
  }

  const ordered = Array.from(days.values()).sort((a, b) => a.date.localeCompare(b.date));
  for (const day of ordered) {
    day.events.sort((a, b) => a.start.localeCompare(b.start));
  }

  return ordered;
}

function assertCalendarsInCache(calendars: string[]): void {
  const cached = getCachedCalendarNames();
  if (!cached) return;

  const missing = calendars.filter((name) => !cached.includes(name));
  if (missing.length === 0) return;

  throw new Error(
    `Unknown Calendar(s) "${missing.join(", ")}". Available calendars: ${cached.join(", ")}`
  );
}

async function executeListCalendars(
  refresh?: boolean
): Promise<{ calendars: string[]; fromCache: boolean }> {
  const cached = getCachedCalendarNames();
  if (cached && !refresh) {
    return { calendars: cached, fromCache: true };
  }

  const scriptLines = buildListCalendarsScript();
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
      result.stderr.trim() || result.stdout.trim() || "osascript failed to read Calendars";
    throw new Error(errorMessage);
  }

  const calendars = parseCalendarListOutput(result.stdout);
  setCachedCalendarNames(calendars);

  return { calendars, fromCache: false };
}

async function executeListEvents(
  startDate: Date,
  endDate: Date,
  calendars?: string[],
  maxResults?: number
): Promise<{ events: CalendarEvent[]; limitReached: boolean; truncated: boolean }> {
  if (calendars?.length) {
    assertCalendarsInCache(calendars);
  }

  const scriptLines = buildListEventsScript();
  const args = scriptLines.flatMap((line) => ["-e", line]);
  const startArg = String(toEpochSeconds(startDate));
  const endArg = String(toEpochSeconds(endDate));
  const calendarsArg = calendars?.length ? calendars.join(RECORD_SEPARATOR) : "";
  const maxResultsArg = maxResults ? String(maxResults) : "";
  const commandArgs = [...args, "--", startArg, endArg, calendarsArg, maxResultsArg];

  const result = await runCommand(OSASCRIPT_PATH, commandArgs, {
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxOutputBytes: DEFAULT_MAX_OUTPUT_BYTES,
  });

  if (result.timedOut) {
    throw new Error(`osascript timed out after ${DEFAULT_TIMEOUT_MS}ms`);
  }

  if (result.exitCode !== 0) {
    const errorMessage =
      result.stderr.trim() || result.stdout.trim() || "osascript failed to read Calendar events";
    throw new Error(errorMessage);
  }

  const events = parseEventsOutput(result.stdout);
  const limitReached = maxResults ? events.length >= maxResults : false;

  return {
    events,
    limitReached,
    truncated: result.truncated,
  };
}

function getWeekRange(reference: Date, weekStartsOn: "monday" | "sunday"): {
  start: Date;
  end: Date;
} {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);

  const day = start.getDay();
  const offset = weekStartsOn === "monday" ? (day + 6) % 7 : day;
  start.setDate(start.getDate() - offset);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  return { start, end };
}

export const calendarListsTool: Tool = {
  name: "calendar.lists",
  description:
    "List available Apple Calendar calendars (cached when possible). Use this when you need a calendar name.",
  parameters: ListCalendarsInputSchema,

  async execute(input: unknown, _context: ToolContext): Promise<unknown> {
    const parsed = ListCalendarsInputSchema.parse(input);
    const result = await executeListCalendars(parsed.refresh);

    return {
      calendars: result.calendars,
      cached: result.fromCache,
      count: result.calendars.length,
    };
  },
};

export const calendarListByDayTool: Tool = {
  name: "calendar.listByDay",
  description: "List Apple Calendar events for a specific day (local time), grouped by day.",
  parameters: ListByDayInputSchema,

  async execute(input: unknown, _context: ToolContext): Promise<unknown> {
    const parsed = ListByDayInputSchema.parse(input);
    const date = parseDateOnly(parsed.date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    const result = await executeListEvents(date, endDate, parsed.calendars, parsed.maxResults);
    const days = groupEventsByDay(result.events);

    return {
      range: {
        start: toDateKey(date),
        end: toDateKey(endDate),
      },
      calendars: parsed.calendars ?? null,
      days,
      totalCount: result.events.length,
      limitReached: result.limitReached,
      truncated: result.truncated,
    };
  },
};

export const calendarWeekTool: Tool = {
  name: "calendar.week",
  description:
    "List Apple Calendar events for the current week (local time), grouped by day.",
  parameters: WeekEventsInputSchema,

  async execute(input: unknown, _context: ToolContext): Promise<unknown> {
    const parsed = WeekEventsInputSchema.parse(input);
    const { start, end } = getWeekRange(new Date(), parsed.weekStartsOn);
    const result = await executeListEvents(start, end, parsed.calendars, parsed.maxResults);
    const days = groupEventsByDay(result.events);

    return {
      range: {
        start: toDateKey(start),
        end: toDateKey(end),
        weekStartsOn: parsed.weekStartsOn,
      },
      calendars: parsed.calendars ?? null,
      days,
      totalCount: result.events.length,
      limitReached: result.limitReached,
      truncated: result.truncated,
    };
  },
};
