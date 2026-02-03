import { calendarListByDayTool, calendarListsTool, calendarWeekTool } from "./calendar.tool";
import { commandTool } from "./command.tool";
import { readFileTool, searchTool } from "./filesystem.tool";
import {
  remindersCreateTool,
  remindersListTool,
  remindersListsTool,
  remindersSearchTool,
  remindersUpdateTool,
} from "./reminders.tool";
import { toolRegistry } from "./tool.registry";

// Register built-in tools
toolRegistry.register(searchTool);
toolRegistry.register(readFileTool);
toolRegistry.register(commandTool);
toolRegistry.register(calendarListsTool);
toolRegistry.register(calendarListByDayTool);
toolRegistry.register(calendarWeekTool);
toolRegistry.register(remindersListsTool);
toolRegistry.register(remindersListTool);
toolRegistry.register(remindersSearchTool);
toolRegistry.register(remindersCreateTool);
toolRegistry.register(remindersUpdateTool);

export type { Tool, ToolContext, ToolResult } from "./tool.types";
export { toolRegistry };

