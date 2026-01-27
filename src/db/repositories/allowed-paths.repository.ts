import { getDb } from "@/db/connection";
import type { AllowedPath, PathPermissions } from "@/db/types";

export const allowedPathsRepo = {
  insert(path: string, permissions: PathPermissions = "read"): number {
    const result = getDb()
      .prepare(
        "INSERT INTO allowed_paths (path, permissions, added_at, added_by) VALUES (?, ?, ?, ?)"
      )
      .run(path, permissions, Date.now(), "cli");

    return result.lastInsertRowid as number;
  },

  findAll(): AllowedPath[] {
    return getDb().prepare("SELECT * FROM allowed_paths ORDER BY added_at").all() as AllowedPath[];
  },

  delete(path: string): boolean {
    const result = getDb().prepare("DELETE FROM allowed_paths WHERE path = ?").run(path);

    return result.changes > 0;
  },

  isAllowedPath(absolutePath: string): { allowed: boolean; permissions: PathPermissions | null } {
    const paths = allowedPathsRepo.findAll();

    for (const entry of paths) {
      if (absolutePath.startsWith(entry.path + "/") || absolutePath === entry.path) {
        return { allowed: true, permissions: entry.permissions };
      }
    }

    return { allowed: false, permissions: null };
  },
};
