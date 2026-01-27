import { getDb } from "@/db/connection";
import type { NewSession, Session } from "@/db/db.types";

export const sessionsRepo = {
  insert(session: NewSession): void {
    getDb()
      .prepare(
        `INSERT INTO sessions (id, client_type, client_id, created_at, last_active_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        session.id,
        session.client_type,
        session.client_id,
        session.created_at,
        session.last_active_at
      );
  },

  findById(id: string): Session | undefined {
    return getDb().prepare("SELECT * FROM sessions WHERE id = ?").get(id) as Session | undefined;
  },

  updateLastActiveAt(id: string): void {
    getDb().prepare("UPDATE sessions SET last_active_at = ? WHERE id = ?").run(Date.now(), id);
  },
};
