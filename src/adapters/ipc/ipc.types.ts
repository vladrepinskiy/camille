export type RequestMessageType = "user_input" | "status" | "create_session";

export interface RequestMessage {
  type: RequestMessageType;
  sessionId?: string;
  text?: string;
}

export type ResponseMessageType =
  | "chunk"
  | "tool_call"
  | "done"
  | "error"
  | "status"
  | "session_created"
  | "processing_status";

export interface ResponseMessage {
  type: ResponseMessageType;
  text?: string;
  name?: string;
  input?: unknown;
  sessionId?: string;
  status?: string;
  error?: string;
  processingStatus?: string; // Processing status for UI display (e.g., "planning", "executing_tool")
  tool?: string; // Tool name when processingStatus is "executing_tool"
}
