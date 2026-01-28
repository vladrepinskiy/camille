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
  | "session_created";

export interface ResponseMessage {
  type: ResponseMessageType;
  text?: string;
  name?: string;
  input?: unknown;
  sessionId?: string;
  status?: string;
  error?: string;
}
