/**
 * Claude CLI adapter — spawns Claude CLI and manages the process lifecycle.
 */
import { spawn, type ChildProcess } from "child_process";
import { buildClaudeArgs, type AgentConfig, type RunTask } from "./args-builder";
import { parseStreamLine, type StreamEvent } from "./parser";

export type ClaudeProcess = {
  child: ChildProcess;
  pid: number;
  kill: (signal?: NodeJS.Signals) => void;
};

export type ClaudeCallbacks = {
  onEvent: (event: StreamEvent) => void;
  onError: (error: string) => void;
  onExit: (code: number | null, signal: NodeJS.Signals | null) => void;
};

const CLAUDE_COMMAND = process.env.MOCK_CLAUDE ?? "claude";

export function spawnClaude(
  config: AgentConfig,
  task: RunTask,
  cwd: string,
  env?: Record<string, string>,
  callbacks?: ClaudeCallbacks
): ClaudeProcess {
  const args = buildClaudeArgs(config, task);

  const child = spawn(CLAUDE_COMMAND, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let buffer = "";

  child.stdout?.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    // Keep the last incomplete line in the buffer
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const event = parseStreamLine(line);
      if (event) {
        callbacks?.onEvent(event);
      }
    }
  });

  child.stderr?.on("data", (chunk: Buffer) => {
    callbacks?.onError(chunk.toString());
  });

  child.on("exit", (code, signal) => {
    // Flush remaining buffer
    if (buffer.trim()) {
      const event = parseStreamLine(buffer);
      if (event) {
        callbacks?.onEvent(event);
      }
    }
    callbacks?.onExit(code, signal);
  });

  return {
    child,
    pid: child.pid!,
    kill: (signal: NodeJS.Signals = "SIGTERM") => {
      if (!child.killed) {
        child.kill(signal);
      }
    },
  };
}
