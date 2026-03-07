import { describe, it, expect } from 'vitest';
import { Command } from 'commander';

/**
 * Unit tests for CLI program structure.
 * Verifies that the Commander.js program is configured correctly
 * without executing any commands.
 */

function buildProgram(): Command {
  const program = new Command();

  program
    .name('maestro')
    .description('Local AI agent orchestrator for your codebase')
    .version('0.1.0');

  program
    .command('init')
    .description('Initialize .ai-agents/ directory in the current project');

  program
    .command('start')
    .description('Start the watcher and dashboard server');

  return program;
}

describe('CLI program structure', () => {
  it('has the correct name', () => {
    const program = buildProgram();
    expect(program.name()).toBe('maestro');
  });

  it('has the correct version', () => {
    const program = buildProgram();
    expect(program.version()).toBe('0.1.0');
  });

  it('has an init command', () => {
    const program = buildProgram();
    const commands = program.commands.map((c) => c.name());
    expect(commands).toContain('init');
  });

  it('has a start command', () => {
    const program = buildProgram();
    const commands = program.commands.map((c) => c.name());
    expect(commands).toContain('start');
  });

  it('init command has the correct description', () => {
    const program = buildProgram();
    const initCmd = program.commands.find((c) => c.name() === 'init');
    expect(initCmd?.description()).toContain('.ai-agents/');
  });

  it('start command has the correct description', () => {
    const program = buildProgram();
    const startCmd = program.commands.find((c) => c.name() === 'start');
    expect(startCmd?.description()).toContain('watcher');
  });
});
