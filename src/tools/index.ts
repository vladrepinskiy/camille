import { commandTool } from "./command.tool";
import { readFileTool, searchTool } from "./filesystem.tool";
import { remindersListTool, remindersSearchTool } from "./reminders.tool";
import { toolRegistry } from "./tool.registry";

// Register built-in tools
toolRegistry.register(searchTool);
toolRegistry.register(readFileTool);
toolRegistry.register(commandTool);
toolRegistry.register(remindersListTool);
toolRegistry.register(remindersSearchTool);

export { toolRegistry };
export type { Tool, ToolContext, ToolResult } from "./tool.types";
