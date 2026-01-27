import type { Agent } from "@/core/agent";

export interface AbstractAdapter {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface AbstractAdapterConstructor {
  new(agent: Agent, ...args: unknown[]): AbstractAdapter;
}
