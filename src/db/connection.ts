import { paths } from "@/utils/paths.util";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = paths.db();
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  initSchema(db);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function initSchema(database: Database.Database): void {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const schemaPath = join(__dirname, "schema.sql");

  const schema = readFileSync(schemaPath, "utf-8");
  database.exec(schema);
}
