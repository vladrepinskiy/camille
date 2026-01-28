// Adapters can use these to show progress to users.
export type OrchestratorStatus =
  | { type: "planning" }
  | { type: "executing_tool"; tool: string }
  | { type: "synthesizing" }
  | { type: "streaming"; chunk: string }
  | { type: "done" };

export interface OrchestratorCallbacks {
  onStatus?: (status: OrchestratorStatus) => void;
  onChunk?: (chunk: string) => void;
}

export interface OrchestratorResponse {
  text: string;
  toolCalls?: Array<{
    tool: string;
    input: unknown;
    result: unknown;
    error?: string;
  }>;
}
