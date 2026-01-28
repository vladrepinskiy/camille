import { paths } from "@/utils/paths.util";
import { connect, type Socket } from "net";
import type { RequestMessage, ResponseMessage } from "./ipc.types";

export class IPCClient {
  private socket: Socket | null = null;
  private sessionId: string | null = null;
  private buffer = "";
  private messageHandlers: Map<string, (message: ResponseMessage) => void> = new Map();
  private messageQueue: ResponseMessage[] = [];

  async connect(): Promise<void> {
    const socketPath = paths.socket();

    return new Promise((resolve, reject) => {
      this.socket = connect(socketPath);

      this.socket.on("connect", () => {
        this.setupDataHandler();
        resolve();
      });

      this.socket.on("error", (err) => {
        reject(new Error(`Failed to connect: ${err.message}`));
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket !== null && !this.socket.destroyed;
  }

  async sendMessage(text: string, onChunk?: (chunk: string) => void): Promise<string> {
    if (!this.socket) {
      throw new Error("Not connected");
    }

    return new Promise((resolve, reject) => {
      let fullResponse = "";

      const handleMessage = (message: ResponseMessage) => {
        switch (message.type) {
          case "chunk":
            if (message.text) {
              fullResponse += message.text;
              onChunk?.(message.text);
            }
            break;

          case "tool_call":
            break;

          case "done":
            resolve(fullResponse);
            break;

          case "error":
            reject(new Error(message.error || "Unknown error"));
            break;
        }
      };

      const requestId = Date.now().toString();
      this.messageHandlers.set(requestId, handleMessage);

      for (const msg of this.messageQueue) {
        handleMessage(msg);
      }
      this.messageQueue = [];

      const request: RequestMessage = {
        type: "user_input",
        sessionId: this.sessionId || undefined,
        text,
      };

      this.socket!.write(JSON.stringify(request) + "\n");
    });
  }

  async getStatus(): Promise<string> {
    if (!this.socket) {
      throw new Error("Not connected");
    }

    return new Promise((resolve, reject) => {
      const handleMessage = (message: ResponseMessage) => {
        if (message.type === "status") {
          resolve(message.status || "unknown");
        } else if (message.type === "error") {
          reject(new Error(message.error || "Unknown error"));
        }
      };

      const requestId = Date.now().toString();
      this.messageHandlers.set(requestId, handleMessage);

      const request: RequestMessage = { type: "status" };
      this.socket!.write(JSON.stringify(request) + "\n");
    });
  }

  private setupDataHandler(): void {
    if (!this.socket) return;

    this.socket.on("data", (data) => {
      this.buffer += data.toString();

      const lines = this.buffer.split("\n");
      this.buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const message = JSON.parse(line) as ResponseMessage;

          for (const handler of this.messageHandlers.values()) {
            handler(message);
          }

          if (message.type === "session_created" && message.sessionId) {
            this.sessionId = message.sessionId;
          }
        } catch {
          // Ignore parse errors
        }
      }
    });
  }
}
