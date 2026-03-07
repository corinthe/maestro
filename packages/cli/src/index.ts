#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { startCommand } from './commands/start.js';

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

program.parse();
