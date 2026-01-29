import type { Orchestrator } from "@/core/orchestrator";

export abstract class AbstractAdapter {
  abstract readonly name: string;

  protected orchestrator: Orchestrator;

  constructor(orchestrator: Orchestrator) {
    this.orchestrator = orchestrator;
  }

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
}
