/**
 * Builds the CLI arguments array for spawning Claude CLI.
 */

export type AgentConfig = {
  model?: string;
  effort?: "low" | "medium" | "high";
  maxTurnsPerRun?: number;
  skipPermissions?: boolean;
};

export type RunTask = {
  prompt: string;
  sessionId?: string;
  skillsDir?: string;
  mcpConfigPath?: string;
  systemPrompt?: string;
};

export function buildClaudeArgs(config: AgentConfig, task: RunTask): string[] {
  const args: string[] = [
    "--print",
    "--output-format", "stream-json",
    "--verbose",
  ];

  if (config.model) {
    args.push("--model", config.model);
  }

  if (config.effort) {
    args.push("--effort", config.effort);
  }

  if (config.maxTurnsPerRun) {
    args.push("--max-turns", String(config.maxTurnsPerRun));
  }

  if (config.skipPermissions !== false) {
    args.push("--dangerously-skip-permissions");
  }

  if (task.skillsDir) {
    args.push("--add-dir", task.skillsDir);
  }

  if (task.mcpConfigPath) {
    args.push("--mcp-config", task.mcpConfigPath);
  }

  if (task.systemPrompt) {
    args.push("--system-prompt", task.systemPrompt);
  }

  if (task.sessionId) {
    args.push("--resume", task.sessionId);
  }

  // Prompt as positional argument (--print already enables non-interactive mode)
  args.push(task.prompt);

  return args;
}
