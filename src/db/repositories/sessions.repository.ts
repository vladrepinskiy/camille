import { getDb } from "@/db/connection";
import type { ClientType, NewSession, Session } from "@/db/db.types";

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

  ensure(id: string, client_type: ClientType, client_id: string | null): void {
    const existing = sessionsRepo.findById(id);
    if (!existing) {
      const now = Date.now();
      sessionsRepo.insert({
        id,
        client_type,
        client_id,
        created_at: now,
        last_active_at: now,
      });

      return;
    }

    sessionsRepo.updateLastActiveAt(id);
  },
};
