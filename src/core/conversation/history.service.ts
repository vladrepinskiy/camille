import { messagesRepo } from "@/db";
import type { Message, MessageRole } from "@/db/db.types";

export type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

const DEFAULT_HISTORY_LIMIT = 10;

function isHistoryRole(role: MessageRole): role is "user" | "assistant" {
  return role === "user" || role === "assistant";
}

function isHistoryRow(row: Message): row is Message & { role: "user" | "assistant" } {
  return isHistoryRole(row.role);
}

export const historyService = {
  getRecent(sessionId: string, limit: number = DEFAULT_HISTORY_LIMIT): HistoryMessage[] {
    const rows = messagesRepo.findRecentBySessionId(sessionId, limit);
    const filtered = rows
      .filter((row) => isHistoryRow(row))
      .map((row) => ({ role: row.role, content: row.content }))
      .reverse();

    return filtered;
  },

  append(
    sessionId: string,
    role: "user" | "assistant",
    content: string,
    createdAt: number = Date.now()
  ): void {
    messagesRepo.insert({
      session_id: sessionId,
      role,
      content,
      created_at: createdAt,
    });
  },
};
