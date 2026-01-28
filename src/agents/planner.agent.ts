import { generateObject } from "ai";
import { z } from "zod";

import type { Config } from "@/core/config";

import { AbstractAgent } from "./abstract.agent";
import type { Plan, PlannerInput } from "./agent.types";

const PlanSchema = z.object({
  reasoning: z.string().describe("Brief explanation of your planning decision"),
  requiresTools: z
    .boolean()
    .describe("Whether tools are needed to answer this request"),
  steps: z
    .array(
      z.object({
        tool: z.string().describe("Name of the tool to call"),
        input: z.record(z.unknown()).describe("Input parameters for the tool"),
      })
    )
    .describe("List of tool calls to make, in order"),
});

export class PlannerAgent extends AbstractAgent {
  readonly name = "planner" as const;

  constructor(config: Config) {
    super("planner", config);
  }

  async run(input: PlannerInput): Promise<Plan> {
    const toolDescriptions = input.tools
      .map(
        (t) =>
          `- ${t.name}: ${t.description}\n  Parameters: ${JSON.stringify(t.parameters)}`
      )
      .join("\n");

    const historyMessages =
      input.history?.map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })) ?? [];

    const { object } = await generateObject({
      model: this.model,
      schema: PlanSchema,
      system: this.systemPrompt,
      messages: [
        ...historyMessages,
        {
          role: "user",
          content: `Available tools:\n${toolDescriptions}\n\nUser request: ${input.message}`,
        },
      ],
      temperature: this.temperature,
    });

    return {
      reasoning: object.reasoning,
      requiresTools: object.requiresTools,
      steps: object.steps,
    };
  }
}
