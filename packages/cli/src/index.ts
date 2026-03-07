#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { startCommand } from './commands/start.js';
import { statusCommand } from './commands/status.js';
import { addCommand } from './commands/add.js';
import { logsCommand } from './commands/logs.js';

const program = new Command();

program
  .name('maestro')
  .description('Local AI agent orchestrator for your codebase')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize .ai-agents/ directory in the current project')
  .action(async () => {
    try {
      await initCommand();
    } catch (error) {
      console.error('Init failed:', error);
      process.exit(1);
    }
  });

program
  .command('start')
  .description('Start the watcher and dashboard server')
  .action(async () => {
    try {
      await startCommand();
    } catch (error) {
      console.error('Start failed:', error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show a quick summary of tasks, agents, and human-queue items')
  .action(async () => {
    try {
      await statusCommand();
    } catch (error) {
      console.error('Status failed:', error);
      process.exit(1);
    }
  });

program
  .command('add <title>')
  .description('Add a task to the backlog')
  .option('-d, --depends <ids...>', 'Task IDs this task depends on')
  .action(async (title: string, opts: { depends?: string[] }) => {
    try {
      await addCommand(title, opts);
    } catch (error) {
      console.error('Add failed:', error);
      process.exit(1);
    }
  });

program
  .command('logs <agent>')
  .description('Stream logs for a specific agent')
  .option('-n, --lines <count>', 'Number of recent lines to show', '50')
  .option('--no-follow', 'Print existing logs and exit without streaming')
  .action(async (agent: string, opts: { follow?: boolean; lines?: string }) => {
    try {
      await logsCommand(agent, opts);
    } catch (error) {
      console.error('Logs failed:', error);
      process.exit(1);
    }
  });

program.parse();
