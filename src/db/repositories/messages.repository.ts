import { getDb } from "@/db/connection";
import type { Message, NewMessage } from "@/db/db.types";

export const messagesRepo = {
  insert(msg: NewMessage): number {
    const result = getDb()
      .prepare(
        `INSERT INTO messages (session_id, role, content, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(msg.session_id, msg.role, msg.content, msg.created_at);

    return result.lastInsertRowid as number;
  },

  findBySessionId(sessionId: string): Message[] {
    return getDb()
      .prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY created_at")
      .all(sessionId) as Message[];
  },

  findRecentBySessionId(sessionId: string, limit: number): Message[] {
    return getDb()
      .prepare(
        "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?"
      )
      .all(sessionId, limit) as Message[];
  },

  deleteBySessionId(sessionId: string): number {
    const result = getDb().prepare("DELETE FROM messages WHERE session_id = ?").run(sessionId);

    return result.changes;
  },
};
