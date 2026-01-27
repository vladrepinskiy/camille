import type { LogLevel } from "@/logging";

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface Message {
  id: number;
  session_id: string;
  role: MessageRole;
  content: string;
  created_at: number;
}

export interface NewMessage {
  session_id: string;
  role: MessageRole;
  content: string;
  created_at: number;
}

export interface ToolCall {
  id: number;
  session_id: string;
  tool_name: string;
  input: string;
  output: string | null;
  error: string | null;
  duration_ms: number | null;
  created_at: number;
}

export interface NewToolCall {
  session_id: string;
  tool_name: string;
  input: string;
  output: string | null;
  error: string | null;
  duration_ms: number | null;
  created_at: number;
}

export interface Log {
  id: number;
  level: LogLevel;
  message: string;
  meta: string | null;
  created_at: number;
}

export interface TelegramUser {
  id: number;
  telegram_id: number;
  username: string | null;
  paired_at: number;
}

export interface NewTelegramUser {
  telegram_id: number;
  username: string | null;
  paired_at: number;
}

export interface PairingCode {
  code_hash: string;
  expires_at: number;
}

export type ClientType = "cli" | "telegram";

export interface Session {
  id: string;
  client_type: ClientType;
  client_id: string | null;
  created_at: number;
  last_active_at: number;
}

export interface NewSession {
  id: string;
  client_type: ClientType;
  client_id: string | null;
  created_at: number;
  last_active_at: number;
}

export type PathPermissions = "read" | "read,write";

export interface AllowedPath {
  id: number;
  path: string;
  permissions: PathPermissions;
  added_at: number;
  added_by: "cli";
}

export interface NewAllowedPath {
  path: string;
  permissions: PathPermissions;
  added_at: number;
  added_by: "cli";
}
