import type { Config } from "@/core/config";
import { messagesRepo, toolCallsRepo } from "@/db";
import { logger } from "@/logging";
import { toolRegistry } from "@/tools";
import type { ToolContext } from "@/tools/tool";
import { generateSessionId } from "@/utils/crypto.util";
import type { AgentResponse } from "./agent.types";

export class Agent {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async processInput(
    input: string,
    sessionId: string,
    onChunk?: (chunk: string) => void
  ): Promise<AgentResponse> {
    messagesRepo.insert({
      session_id: sessionId,
      role: "user",
      content: input,
      created_at: Date.now(),
    });

    logger.debug("Processing input", { sessionId, input: input.slice(0, 100) });

    const trimmed = input.trim();

    // Check for tool invocation (format: /tool_name args)
    if (trimmed.startsWith("/")) {
      const [command, ...args] = trimmed.slice(1).split(" ");
      const toolName = command?.toLowerCase();

      if (toolName && toolRegistry.has(toolName)) {
        return this.executeTool(toolName, args.join(" "), sessionId, onChunk);
      }
    }

    const response = this.generateMvpResponse(trimmed);

    if (onChunk) {
      onChunk(response);
    }

    messagesRepo.insert({
      session_id: sessionId,
      role: "assistant",
      content: response,
      created_at: Date.now(),
    });

    return { text: response };
  }

  private async executeTool(
    toolName: string,
    argsString: string,
    sessionId: string,
    onChunk?: (chunk: string) => void
  ): Promise<AgentResponse> {
    const tool = toolRegistry.get(toolName);
    if (!tool) {
      const response = `Unknown tool: ${toolName}`;
      if (onChunk) onChunk(response);

      return { text: response };
    }

    const context: ToolContext = {
      sessionId,
      agentHome: this.config.llm.provider,
    };

    const startTime = Date.now();
    let output: unknown;
    let error: string | undefined;

    try {
      if (onChunk) {
        onChunk(`Executing ${toolName}...`);
      }

      let parsedInput: unknown;
      try {
        parsedInput = JSON.parse(argsString);
      } catch {
        parsedInput = { query: argsString };
      }

      output = await tool.execute(parsedInput, context);

      const durationMs = Date.now() - startTime;
      logger.tool(toolName, { input: parsedInput, output, durationMs });

      toolCallsRepo.insert({
        session_id: sessionId,
        tool_name: toolName,
        input: JSON.stringify(parsedInput),
        output: JSON.stringify(output),
        error: null,
        duration_ms: durationMs,
        created_at: Date.now(),
      });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      logger.error(`Tool ${toolName} failed`, { error });

      toolCallsRepo.insert({
        session_id: sessionId,
        tool_name: toolName,
        input: argsString,
        output: null,
        error,
        duration_ms: Date.now() - startTime,
        created_at: Date.now(),
      });
    }

    const response = error
      ? `Error: ${error}`
      : typeof output === "string"
        ? output
        : JSON.stringify(output, null, 2);

    if (onChunk) {
      onChunk("\n" + response);
    }

    messagesRepo.insert({
      session_id: sessionId,
      role: "assistant",
      content: response,
      created_at: Date.now(),
    });

    return {
      text: response,
      toolCalls: [{ name: toolName, input: argsString, output, error }],
    };
  }

  private generateMvpResponse(input: string): string {
    const tools = Array.from(toolRegistry.keys());

    return (
      `[MVP Mode - No LLM configured]\n\n` +
      `You said: "${input}"\n\n` +
      `Available commands:\n` +
      `  /search <query>  - Search files\n\n` +
      `Available tools: ${tools.join(", ") || "none"}\n\n` +
      `Configure an LLM in ~/.camille/config.toml for full functionality.`
    );
  }

  createSession(): string {
    return generateSessionId();
  }
}
