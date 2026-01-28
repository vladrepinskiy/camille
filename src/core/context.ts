import { ClientType, MessageRole, messagesRepo, sessionsRepo, type Message } from "@/db";
import { generateSessionId } from "@/utils/crypto.util";

export class ConversationContext {
  readonly sessionId: string;
  readonly clientType: ClientType;
  readonly clientId: string | null;

  constructor(sessionId: string, clientType: ClientType, clientId: string | null = null) {
    this.sessionId = sessionId;
    this.clientType = clientType;
    this.clientId = clientId;
  }

  getMessages(): Message[] {
    return messagesRepo.findBySessionId(this.sessionId);
  }

  addMessage(role: MessageRole, content: string): void {
    messagesRepo.insert({
      session_id: this.sessionId,
      role,
      content,
      created_at: Date.now(),
    });
    sessionsRepo.updateLastActiveAt(this.sessionId);
  }

  getRecentMessages(limit: number = 20): Message[] {
    const messages = this.getMessages();
    return messages.slice(-limit);
  }

  static create(
    clientType: ClientType,
    clientId: string | null = null
  ): ConversationContext {
    const sessionId = generateSessionId();

    sessionsRepo.insert({
      id: sessionId,
      client_type: clientType,
      client_id: clientId,
      created_at: Date.now(),
      last_active_at: Date.now(),
    });

    return new ConversationContext(sessionId, clientType, clientId);
  }

  static load(sessionId: string): ConversationContext | null {
    const session = sessionsRepo.findById(sessionId);
    if (!session) return null;

    return new ConversationContext(session.id, session.client_type, session.client_id);
  }
}
