import type { Tool } from "./tool.types";

class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  keys(): IterableIterator<string> {
    return this.tools.keys();
  }

  values(): IterableIterator<Tool> {
    return this.tools.values();
  }

  entries(): IterableIterator<[string, Tool]> {
    return this.tools.entries();
  }
}

export const toolRegistry = new ToolRegistry();
