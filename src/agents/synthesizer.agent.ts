import type { Config } from "@/core/config";
import { streamText } from "ai";
import { AbstractAgent } from "./abstract.agent";
import type { SynthesizerInput } from "./agent.types";

export class SynthesizerAgent extends AbstractAgent {
  readonly name = "synthesizer" as const;

  constructor(config: Config) {
    super("synthesizer", config);
  }

  async run(
    input: SynthesizerInput,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    const toolResultsText =
      input.toolResults.length > 0
        ? `Tool results:\n${input.toolResults
          .map((r) => {
            if (r.error) {
              return `- ${r.tool}: ERROR - ${r.error}`;
            }

            return `- ${r.tool}: ${JSON.stringify(r.result)}`;
          })
          .join("\n")}\n\n`
        : "";

    const historyMessages =
      input.history?.map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })) ?? [];

    const result = await streamText({
      model: this.model,
      system: this.systemPrompt,
      messages: [
        ...historyMessages,
        {
          role: "user",
          content: `${toolResultsText}User request: ${input.message}`,
        },
      ],
    });

    let fullText = "";

    for await (const chunk of result.textStream) {
      fullText += chunk;
      onChunk?.(chunk);
    }

    return fullText;
  }
}
