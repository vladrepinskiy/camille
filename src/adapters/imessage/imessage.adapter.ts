import type { Orchestrator } from "@/core/orchestrator";
import { logger } from "@/logging";

import { AbstractAdapter } from "../abstract.adapter";

// TODO [VR]: Implement iMessage integration
// Possible approaches:
// - Use AppleScript via osascript to read/send messages
// - Use sqlite3 to read ~/Library/Messages/chat.db (read-only)
// - Use a bridge app like BlueBubbles or AirMessage

export class IMessageAdapter extends AbstractAdapter {
  readonly name = "imessage";

  constructor(orchestrator: Orchestrator) {
    super(orchestrator);
  }

  async start(): Promise<void> {
    logger.warn("iMessage adapter not implemented yet");
  }

  async stop(): Promise<void> {
    // No-op
  }
}
