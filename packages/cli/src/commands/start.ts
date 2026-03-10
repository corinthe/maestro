import { resolveAgentsPath, fileExists, createLogger } from '@maestro/core';
import { startWatcher } from '@maestro/watcher';
import { startServer, appendLog, broadcast } from '@maestro/server';
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
  const { server, wss, isPaused } = startServer(projectRoot);

  // Log callback: store in-memory (for REST /api/logs) AND broadcast via WebSocket (real-time dashboard)
  const dispatchLog = (
    level: 'info' | 'warn' | 'error' | 'debug',
    agent: string,
    message: string
  ) => {
    const entry = { timestamp: new Date().toISOString(), agent, level, message };
    appendLog(entry);
    broadcast(wss, { type: 'log-entry', ...entry });
  };

  // Create the signal dispatcher wired to orchestrator + runners
  const dispatch = createDispatcher({ projectRoot, wss, log: dispatchLog, isPaused });

  // Start watcher with the dispatcher as signal handler
  const watcher = await startWatcher({
    projectRoot,
    onSignal: async (signal: Signal) => {
      log.info({ signalType: signal.type, taskId: signal.taskId }, `Signal received: ${signal.type}`);
      try {
        await dispatch(signal);
      } catch (error) {
        log.error({ err: error, signalType: signal.type }, `Error handling signal ${signal.type}`);
        dispatchLog('error', 'orchestrator', `Error handling signal "${signal.type}": ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  });

  log.info('Watcher and server are running.');
  log.info('Dashboard: http://localhost:7842');
  console.log('Press Ctrl+C to stop.\n');

  // Graceful shutdown
  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) {
      log.info('Forced exit.');
      process.exit(1);
    }
    shuttingDown = true;
    log.info('Shutting down...');
    watcher.close();
    // Close all WebSocket connections so the server can actually close
    for (const client of wss.clients) {
      client.close();
    }
    server.close(() => {
      log.info('Stopped.');
      process.exit(0);
    });
    // Force exit if server hasn't closed within 3 seconds
    setTimeout(() => {
      log.warn('Shutdown timed out, forcing exit.');
      process.exit(1);
    }, 3000).unref();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
