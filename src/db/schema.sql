-- Conversation messages
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);

-- Tool execution history
CREATE TABLE IF NOT EXISTS tool_calls (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  input TEXT NOT NULL,
  output TEXT,
  error TEXT,
  duration_ms INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tool_calls_session ON tool_calls(session_id);

-- Structured logs
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  meta TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at);

-- Telegram authorized users
CREATE TABLE IF NOT EXISTS telegram_users (
  id INTEGER PRIMARY KEY,
  telegram_id INTEGER UNIQUE NOT NULL,
  username TEXT,
  paired_at INTEGER NOT NULL
);

-- Pairing codes (short-lived)
CREATE TABLE IF NOT EXISTS pairing_codes (
  code_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

-- Sessions (CLI / Telegram)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  client_type TEXT NOT NULL,
  client_id TEXT,
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL
);

-- Filesystem permissions (CLI-managed only)
CREATE TABLE IF NOT EXISTS allowed_paths (
  id INTEGER PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  permissions TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  added_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_allowed_paths_path ON allowed_paths(path);
