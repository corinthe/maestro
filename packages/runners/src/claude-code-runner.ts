import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import type { Agent, AgentRunResult, AgentRunner } from '@maestro/core';

export class ClaudeCodeRunner implements AgentRunner {
  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('claude', ['--version'], { stdio: 'pipe' });
      proc.on('error', () => resolve(false));
      proc.on('close', (code) => resolve(code === 0));
    });
  }

  async run(agent: Agent, contextPath: string): Promise<AgentRunResult> {
    const context = await fs.readFile(contextPath, 'utf-8');

    return new Promise((resolve) => {
      const proc = spawn('claude', ['--print', context], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
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
