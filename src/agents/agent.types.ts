export type AgentType = "planner" | "synthesizer";

export interface PlanStep {
  tool: string;
  input: Record<string, unknown>;
}

export interface Plan {
  reasoning: string;
  steps: PlanStep[];
  requiresTools: boolean;
}

export interface ToolExecutionResult {
  tool: string;
  result: unknown;
  error?: string;
}

export interface PlannerInput {
  message: string;
  tools: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

export interface SynthesizerInput {
  message: string;
  toolResults: ToolExecutionResult[];
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}
