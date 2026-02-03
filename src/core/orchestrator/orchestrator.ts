import {
  DEFAULT_AGENT_CONFIG,
  PlannerAgent,
  SynthesizerAgent,
  type Plan,
  type ToolExecutionResult,
} from "@/agents";
import type { Config } from "@/core/config";
import { historyService } from "@/core/conversation/history.service";
import { toolCallsRepo } from "@/db";
import { logger } from "@/logging";
import { toolRegistry, type ToolContext } from "@/tools";
import { generateSessionId } from "@/utils/crypto.util";
import { safeJsonStringify } from "@/utils/json.util";
import { zodToJsonSchema } from "zod-to-json-schema";
import type {
  OrchestratorCallbacks,
  OrchestratorResponse,
  OrchestratorStatus,
} from "./orchestrator.types";

function getToolDescriptions(): Array<{
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}> {
  const tools: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }> = [];

  for (const tool of toolRegistry.values()) {
    tools.push({
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.parameters) as Record<string, unknown>,
    });
  }

  return tools;
}

async function executePlan(
  plan: Plan,
  maxToolCalls: number,
  context: ToolContext,
  onStatus?: (status: OrchestratorStatus) => void
): Promise<ToolExecutionResult[]> {
  const results: ToolExecutionResult[] = [];
  const steps = plan.steps.slice(0, maxToolCalls);

  for (const step of steps) {
    onStatus?.({ type: "executing_tool", tool: step.tool });

    const tool = toolRegistry.get(step.tool);
    if (!tool) {
      logger.warn(`Tool not found: ${step.tool}`);
      results.push({
        tool: step.tool,
        result: null,
        error: `Tool "${step.tool}" not found`,
      });

      toolCallsRepo.insert({
        session_id: context.sessionId,
        tool_name: step.tool,
        input: safeJsonStringify(step.input) ?? "{}",
        output: null,
        error: `Tool "${step.tool}" not found`,
        duration_ms: null,
        created_at: Date.now(),
      });

      continue;
    }

    const startedAt = Date.now();
    try {
      const result = await tool.execute(step.input, context);
      const durationMs = Date.now() - startedAt;
      results.push({ tool: step.tool, result });
      logger.tool(step.tool, { input: step.input, output: result });

      toolCallsRepo.insert({
        session_id: context.sessionId,
        tool_name: step.tool,
        input: safeJsonStringify(step.input) ?? "{}",
        output: safeJsonStringify(result),
        error: null,
        duration_ms: durationMs,
        created_at: Date.now(),
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const durationMs = Date.now() - startedAt;
      logger.error(`Tool ${step.tool} failed`, { error });
      results.push({ tool: step.tool, result: null, error });

      toolCallsRepo.insert({
        session_id: context.sessionId,
        tool_name: step.tool,
        input: safeJsonStringify(step.input) ?? "{}",
        output: null,
        error,
        duration_ms: durationMs,
        created_at: Date.now(),
      });
    }
  }

  return results;
}

export class Orchestrator {
  private config: Config;
  private planner: PlannerAgent;
  private synthesizer: SynthesizerAgent;

  constructor(config: Config) {
    this.config = config;
    this.planner = new PlannerAgent(config);
    this.synthesizer = new SynthesizerAgent(config);
  }

  createSession(): string {
    return generateSessionId();
  }

  async processMessage(
    input: string,
    sessionId: string,
    callbacks?: OrchestratorCallbacks
  ): Promise<OrchestratorResponse> {
    const { onStatus, onChunk } = callbacks ?? {};
    const maxToolCalls =
      this.config.maxToolCalls ?? DEFAULT_AGENT_CONFIG.maxToolCalls;

    const context: ToolContext = {
      sessionId,
      agentHome: this.config.llm.provider,
    };
    const history = historyService.getRecent(sessionId);
    const userMessageAt = Date.now();
    historyService.append(sessionId, "user", input, userMessageAt);

    // 1. Run planner (LLM call)
    onStatus?.({ type: "planning" });
    logger.debug("Running planner", { sessionId, input: input.slice(0, 100) });

    const tools = getToolDescriptions();
    const plan = await this.planner.run({
      message: input,
      tools,
      history,
    });

    logger.debug("Plan created", {
      requiresTools: plan.requiresTools,
      steps: plan.steps.length,
      reasoning: plan.reasoning,
    });

    // 2. If no tools needed, synthesize directly
    if (!plan.requiresTools || plan.steps.length === 0) {
      onStatus?.({ type: "synthesizing" });
      const text = await this.synthesizer.run(
        { message: input, toolResults: [], history },
        (chunk) => {
          onStatus?.({ type: "streaming", chunk });
          onChunk?.(chunk);
        }
      );

      onStatus?.({ type: "done" });
      const assistantMessageAt = Math.max(Date.now(), userMessageAt + 1);
      historyService.append(sessionId, "assistant", text, assistantMessageAt);

      return { text };
    }

    // 3. Execute tools (NO LLM - just runs the plan)
    const toolResults = await executePlan(plan, maxToolCalls, context, onStatus);

    // 4. Synthesize final response (LLM call)
    onStatus?.({ type: "synthesizing" });
    const text = await this.synthesizer.run(
      { message: input, toolResults, history },
      (chunk) => {
        onStatus?.({ type: "streaming", chunk });
        onChunk?.(chunk);
      }
    );

    onStatus?.({ type: "done" });
    const assistantMessageAt = Math.max(Date.now(), userMessageAt + 1);
    historyService.append(sessionId, "assistant", text, assistantMessageAt);

    return {
      text,
      toolCalls: toolResults.map((r) => ({
        tool: r.tool,
        input: plan.steps.find((s) => s.tool === r.tool)?.input,
        result: r.result,
        error: r.error,
      })),
    };
  }
}
