import type { AgentRunner } from '@maestro/core';

export type { AgentRunner };

export function createRunner(type: string): AgentRunner {
  switch (type) {
    case 'claude-code':
      // Lazy import to avoid loading all runners
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ClaudeCodeRunner } = require('./claude-code-runner.js');
      return new ClaudeCodeRunner();
    default:
      throw new Error(`Unknown runner type: ${type}`);
  }
}
