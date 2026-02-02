import { spawn } from "child_process";

export interface CommandResult {
  command: string;
  args: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  truncated: boolean;
}

export interface CommandOptions {
  timeoutMs?: number;
  maxOutputBytes?: number;
}

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_OUTPUT_BYTES = 100_000;

export async function runCommand(
  command: string,
  args: string[],
  options: CommandOptions = {}
): Promise<CommandResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let truncated = false;

    const appendChunk = (chunk: Buffer, target: "stdout" | "stderr") => {
      const text = chunk.toString("utf-8");
      if (target === "stdout") {
        if (stdout.length + text.length > maxOutputBytes) {
          const remaining = Math.max(0, maxOutputBytes - stdout.length);
          stdout += text.slice(0, remaining);
          truncated = true;
          child.kill("SIGKILL");

          return;
        }

        stdout += text;
        return;
      }

      if (stderr.length + text.length > maxOutputBytes) {
        const remaining = Math.max(0, maxOutputBytes - stderr.length);
        stderr += text.slice(0, remaining);
        truncated = true;
        child.kill("SIGKILL");

        return;
      }

      stderr += text;
    };

    child.stdout?.on("data", (chunk) => appendChunk(chunk, "stdout"));
    child.stderr?.on("data", (chunk) => appendChunk(chunk, "stderr"));

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({
        command,
        args,
        exitCode: code,
        stdout,
        stderr,
        timedOut,
        truncated,
      });
    });
  });
}
