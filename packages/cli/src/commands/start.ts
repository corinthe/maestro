import { resolveAgentsPath, fileExists, createLogger } from '@maestro/core';
import { startWatcher } from '@maestro/watcher';
import { startServer } from '@maestro/server';
import { createDispatcher } from '@maestro/orchestrator';
import type { Signal } from '@maestro/core';

export async function startCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const agentsRoot = resolveAgentsPath(projectRoot);

  if (!(await fileExists(agentsRoot))) {
    console.error('No .ai-agents/ directory found. Run `maestro init` first.');
    process.exit(1);
  }

  const log = createLogger({ projectRoot, component: 'maestro', level: 'info' });

  log.info('Starting orchestrator...');

  // Start server first so we have the WebSocket server for broadcasting
  const { server, wss } = startServer(projectRoot);

  // Create the signal dispatcher wired to orchestrator + runners
  const dispatch = createDispatcher({ projectRoot, wss });

  // Start watcher with the dispatcher as signal handler
  const watcher = startWatcher({
    projectRoot,
    onSignal: async (signal: Signal) => {
      log.info({ signalType: signal.type, taskId: signal.taskId }, `Signal received: ${signal.type}`);
      try {
        await dispatch(signal);
      } catch (error) {
        log.error({ err: error, signalType: signal.type }, `Error handling signal ${signal.type}`);
      }
    },
  });

  log.info('Watcher and server are running.');
  log.info('Dashboard: http://localhost:7842');
  console.log('Press Ctrl+C to stop.\n');

  // Graceful shutdown
  const shutdown = () => {
    log.info('Shutting down...');
    watcher.close();
    server.close(() => {
      log.info('Stopped.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
