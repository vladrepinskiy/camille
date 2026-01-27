import type { z } from "zod";

export interface ToolContext {
  sessionId: string;
  agentHome: string;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  execute(input: unknown, context: ToolContext): Promise<unknown>;
}
