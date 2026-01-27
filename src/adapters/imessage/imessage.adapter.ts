import type { Agent } from "@/core/agent";
import { logger } from "@/logging";
import type { AbstractAdapter } from "../abstract.adapter";

// TODO [VR]: Implement iMessage integration
// Possible approaches:
// - Use AppleScript via osascript to read/send messages
// - Use sqlite3 to read ~/Library/Messages/chat.db (read-only)
// - Use a bridge app like BlueBubbles or AirMessage

export class IMessageAdapter implements AbstractAdapter {
  readonly name = "imessage";

  private agent: Agent;

  constructor(agent: Agent) {
    this.agent = agent;
  }

  async start(): Promise<void> {
    logger.warn("iMessage adapter not implemented yet");
  }

  async stop(): Promise<void> {
    // No-op
  }
}
