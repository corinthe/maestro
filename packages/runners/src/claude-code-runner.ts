import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import type { Agent, AgentRunResult, AgentRunner, AgentRunOptions } from '@maestro/core';

function getClaudeCommand(): { command: string; prefixArgs: string[] } {
  const customCommand = process.env.CLAUDE_COMMAND;
  if (customCommand) {
    return { command: customCommand, prefixArgs: [] };
  }
  return { command: 'claude', prefixArgs: [] };
}

function getWslClaudeCommand(): { command: string; prefixArgs: string[] } {
  return { command: 'wsl', prefixArgs: ['claude'] };
}

function isWindows(): boolean {
  return os.platform() === 'win32';
}

export class ClaudeCodeRunner implements AgentRunner {
  private resolvedCommand: { command: string; prefixArgs: string[] } | null = null;

  private async resolveCommand(): Promise<{ command: string; prefixArgs: string[] }> {
    if (this.resolvedCommand) {
      return this.resolvedCommand;
    }

    const primary = getClaudeCommand();
    const available = await this.checkCommand(primary);
    if (available) {
      this.resolvedCommand = primary;
      return primary;
    }

    // On Windows, try WSL fallback if direct claude is not available
    if (isWindows() && !process.env.CLAUDE_COMMAND) {
      const wslCmd = getWslClaudeCommand();
      const wslAvailable = await this.checkCommand(wslCmd);
      if (wslAvailable) {
        this.resolvedCommand = wslCmd;
        return wslCmd;
      }
    }

    // Return primary even if not available, so error messages are clear
    return primary;
  }

  private checkCommand(cmd: { command: string; prefixArgs: string[] }): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(cmd.command, [...cmd.prefixArgs, '--version'], { stdio: 'pipe' });
      proc.on('error', () => resolve(false));
      proc.on('close', (code) => resolve(code === 0));
    });
  }

  async isAvailable(): Promise<boolean> {
    const cmd = await this.resolveCommand();
    return this.checkCommand(cmd);
  }

  async run(agent: Agent, contextPath: string, options?: AgentRunOptions): Promise<AgentRunResult> {
    const context = await fs.readFile(contextPath, 'utf-8');
    const cmd = await this.resolveCommand();

    return new Promise((resolve) => {
      const args = [
        ...cmd.prefixArgs,
        '--print',
        '--dangerously-skip-permissions',
        '--verbose',
      ];

      const proc = spawn(cmd.command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Send context via stdin instead of CLI argument to avoid ARG_MAX limits
      proc.stdin.write(context);
      proc.stdin.end();

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        stdout += text;
        options?.onOutput?.({ stream: 'stdout', text });
      });

      proc.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        stderr += text;
        options?.onOutput?.({ stream: 'stderr', text });
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            summary: stdout.trim(),
          });
        } else {
          resolve({
            success: false,
            summary: '',
            error: stderr.trim() || `Process exited with code ${code}`,
          });
        }
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          summary: '',
          error: err.message,
        });
      });
    });
  }
}
