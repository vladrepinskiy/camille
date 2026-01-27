export interface ToolCallResult {
  name: string;
  input: unknown;
  output: unknown;
  error?: string;
}

export interface AgentResponse {
  text: string;
  toolCalls?: ToolCallResult[];
}
