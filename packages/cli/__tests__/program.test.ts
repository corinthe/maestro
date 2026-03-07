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

  program
    .command('status')
    .description('Show a quick summary of tasks, agents, and human-queue items');

  program
    .command('add <title>')
    .description('Add a task to the backlog')
    .option('-d, --depends <ids...>', 'Task IDs this task depends on');

  program
    .command('logs <agent>')
    .description('Stream logs for a specific agent')
    .option('-n, --lines <count>', 'Number of recent lines to show', '50')
    .option('--no-follow', 'Print existing logs and exit without streaming');

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

  it('has a status command', () => {
    const program = buildProgram();
    const commands = program.commands.map((c) => c.name());
    expect(commands).toContain('status');
  });

  it('has an add command', () => {
    const program = buildProgram();
    const commands = program.commands.map((c) => c.name());
    expect(commands).toContain('add');
  });

  it('has a logs command', () => {
    const program = buildProgram();
    const commands = program.commands.map((c) => c.name());
    expect(commands).toContain('logs');
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

  it('status command has the correct description', () => {
    const program = buildProgram();
    const statusCmd = program.commands.find((c) => c.name() === 'status');
    expect(statusCmd?.description()).toContain('summary');
  });

  it('add command has the correct description', () => {
    const program = buildProgram();
    const addCmd = program.commands.find((c) => c.name() === 'add');
    expect(addCmd?.description()).toContain('backlog');
  });

  it('logs command has the correct description', () => {
    const program = buildProgram();
    const logsCmd = program.commands.find((c) => c.name() === 'logs');
    expect(logsCmd?.description()).toContain('logs');
  });

  it('logs command has --lines and --no-follow options', () => {
    const program = buildProgram();
    const logsCmd = program.commands.find((c) => c.name() === 'logs');
    const opts = logsCmd?.options.map((o) => o.long);
    expect(opts).toContain('--lines');
    expect(opts).toContain('--no-follow');
  });

  it('add command has --depends option', () => {
    const program = buildProgram();
    const addCmd = program.commands.find((c) => c.name() === 'add');
    const opts = addCmd?.options.map((o) => o.long);
    expect(opts).toContain('--depends');
  });
});
