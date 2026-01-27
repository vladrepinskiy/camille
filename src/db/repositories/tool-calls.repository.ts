import { getDb } from "@/db/connection";
import type { NewToolCall, ToolCall } from "@/db/types";

export const toolCallsRepo = {
  insert(call: NewToolCall): number {
    const result = getDb()
      .prepare(
        `INSERT INTO tool_calls (session_id, tool_name, input, output, error, duration_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        call.session_id,
        call.tool_name,
        call.input,
        call.output,
        call.error,
        call.duration_ms,
        call.created_at
      );

    return result.lastInsertRowid as number;
  },

  findBySessionId(sessionId: string): ToolCall[] {
    return getDb()
      .prepare("SELECT * FROM tool_calls WHERE session_id = ? ORDER BY created_at")
      .all(sessionId) as ToolCall[];
  },
};
