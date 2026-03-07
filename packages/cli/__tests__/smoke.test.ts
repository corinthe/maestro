import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Smoke tests that run the CLI binary as a subprocess.
 * These tests require the package to be built first (npm run build).
 * They verify that the CLI executable runs without crashing.
 */

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CLI_DIST = resolve(__dirname, '../dist/index.js');

function runCli(args: string[]): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync('node', [CLI_DIST, ...args], {
    encoding: 'utf-8',
    timeout: 10_000,
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status,
  };
}

describe('CLI smoke tests (requires built dist/)', () => {
  it('exits with code 0 for --help', () => {
    const { status, stdout } = runCli(['--help']);
    expect(status).toBe(0);
    expect(stdout).toContain('maestro');
  });

  it('--help output lists init command', () => {
    const { stdout } = runCli(['--help']);
    expect(stdout).toContain('init');
  });

  it('--help output lists start command', () => {
    const { stdout } = runCli(['--help']);
    expect(stdout).toContain('start');
  });

  it('exits with code 0 for --version', () => {
    const { status, stdout } = runCli(['--version']);
    expect(status).toBe(0);
    expect(stdout.trim()).toBe('0.1.0');
  });

  it('exits with non-zero code for unknown command', () => {
    const { status } = runCli(['unknown-command-xyz']);
    expect(status).not.toBe(0);
  });

  it('init --help shows init description', () => {
    const { status, stdout } = runCli(['init', '--help']);
    expect(status).toBe(0);
    expect(stdout).toContain('.ai-agents/');
  });

  it('start --help shows start description', () => {
    const { status, stdout } = runCli(['start', '--help']);
    expect(status).toBe(0);
    expect(stdout).toContain('watcher');
  });
});
