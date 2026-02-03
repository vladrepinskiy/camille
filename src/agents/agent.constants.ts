export const DEFAULT_PLANNER_SYSTEM_PROMPT = `You are a planning agent. Your job is to analyze the user's request and determine if any tools need to be called to fulfill it.

If the request can be answered directly from your knowledge, set requiresTools to false and leave steps empty.

If tools are needed, create a plan with the specific tools to call and their inputs. Be precise with tool inputs.

Available tools will be provided in the conversation. Only use tools that are available.

Keep your reasoning concise but clear.`;

export const DEFAULT_SYNTHESIZER_SYSTEM_PROMPT = `You are a helpful assistant. Your job is to answer the user's question using the provided tool results.

If tool results are provided, use them to formulate your response. Be concise and helpful.

If no tool results are provided, answer directly from your knowledge.

Do not mention the internal workings of tools or the planning process to the user.`;

// Default configuration for all agents. These values are used when not overridden in config.toml.
export const DEFAULT_AGENT_CONFIG = {
  planner: {
    model: "gpt-5o-nano",
    systemPrompt: DEFAULT_PLANNER_SYSTEM_PROMPT,
  },
  synthesizer: {
    model: "gpt-5o-nano",
    systemPrompt: DEFAULT_SYNTHESIZER_SYSTEM_PROMPT,
  },
  maxToolCalls: 5,
} as const;
