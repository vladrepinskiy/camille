import type { Config } from "@/core/config";
import { logger } from "@/logging";
import { generateObject } from "ai";
// TODO [VR]: replace generateObject as it's outdated
import { z } from "zod";

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
        input: z
          .string()
          .describe(
            "Input parameters for the tool as a JSON string (e.g., '{\"query\":\"test\"}')"
          ),
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
      steps: object.steps.map((step) => {
        let parsedInput: Record<string, unknown>;

        try {
          parsedInput = JSON.parse(step.input) as Record<string, unknown>;
        } catch (err) {
          // If parsing fails, log and use empty object
          logger.warn(`Failed to parse tool input JSON for ${step.tool}`, {
            input: step.input,
            error: err instanceof Error ? err.message : String(err),
          });
          parsedInput = {};
        }

        return {
          tool: step.tool,
          input: parsedInput,
        };
      }),
    };
  }
}
