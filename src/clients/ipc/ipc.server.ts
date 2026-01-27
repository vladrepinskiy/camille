import type { Agent } from "@/core/agent";
import { logger } from "@/logging";
import { generateSessionId } from "@/utils/crypto.util";
import { paths } from "@/utils/paths.util";
import { existsSync, unlinkSync } from "fs";
import { createServer, type Server, type Socket } from "net";
import type { RequestMessage, ResponseMessage } from "./ipc.types";

export class IPCServer {
  private server: Server | null = null;
  private agent: Agent;
  private connections: Set<Socket> = new Set();

  constructor(agent: Agent) {
    this.agent = agent;
  }

  async start(): Promise<void> {
    const socketPath = paths.socket();

    if (existsSync(socketPath)) {
      unlinkSync(socketPath);
    }

    return new Promise((resolve, reject) => {
      this.server = createServer((socket) => this.handleConnection(socket));

      this.server.on("error", (err) => {
        logger.error("IPC server error", { error: err.message });
        reject(err);
      });

      this.server.listen(socketPath, () => {
        logger.debug("IPC server listening", { socket: socketPath });
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    for (const socket of this.connections) {
      socket.destroy();
    }
    this.connections.clear();

    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          const socketPath = paths.socket();
          if (existsSync(socketPath)) {
            try {
              unlinkSync(socketPath);
            } catch {
              // Ignore
            }
          }
          resolve();
        });
      });
    }
  }

  private handleConnection(socket: Socket): void {
    logger.debug("IPC client connected");
    this.connections.add(socket);

    let buffer = "";
    let sessionId = generateSessionId();

    socket.on("data", async (data) => {
      buffer += data.toString();

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const message = JSON.parse(line) as RequestMessage;
          await this.handleMessage(socket, message, sessionId);
        } catch (err) {
          this.sendMessage(socket, {
            type: "error",
            error: `Invalid message: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
    });

    socket.on("close", () => {
      logger.debug("IPC client disconnected");
      this.connections.delete(socket);
    });

    socket.on("error", (err) => {
      logger.debug("IPC socket error", { error: err.message });
      this.connections.delete(socket);
    });
  }

  private async handleMessage(
    socket: Socket,
    message: RequestMessage,
    sessionId: string
  ): Promise<void> {
    switch (message.type) {
      case "create_session": {
        const newSessionId = this.agent.createSession();
        this.sendMessage(socket, {
          type: "session_created",
          sessionId: newSessionId,
        });
        break;
      }

      case "status": {
        this.sendMessage(socket, {
          type: "status",
          status: "running",
        });
        break;
      }

      case "user_input": {
        if (!message.text) {
          this.sendMessage(socket, {
            type: "error",
            error: "Missing text in user_input message",
          });

          return;
        }

        const effectiveSessionId = message.sessionId || sessionId;

        try {
          const response = await this.agent.processInput(
            message.text,
            effectiveSessionId,
            (chunk) => {
              this.sendMessage(socket, { type: "chunk", text: chunk });
            }
          );

          if (response.toolCalls) {
            for (const call of response.toolCalls) {
              this.sendMessage(socket, {
                type: "tool_call",
                name: call.name,
                input: call.input,
              });
            }
          }

          this.sendMessage(socket, { type: "done" });
        } catch (err) {
          this.sendMessage(socket, {
            type: "error",
            error: err instanceof Error ? err.message : String(err),
          });
        }
        break;
      }

      default:
        this.sendMessage(socket, {
          type: "error",
          error: `Unknown message type: ${(message as RequestMessage).type}`,
        });
    }
  }

  private sendMessage(socket: Socket, message: ResponseMessage): void {
    if (!socket.destroyed) {
      socket.write(JSON.stringify(message) + "\n");
    }
  }
}
