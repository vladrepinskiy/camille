import { readFileTool, searchTool } from "./filesystem.tool";
import { toolRegistry } from "./tool.registry";

// Register built-in tools
toolRegistry.register(searchTool);
toolRegistry.register(readFileTool);

export { toolRegistry };
export type { Tool, ToolContext, ToolResult } from "./tool.types";
