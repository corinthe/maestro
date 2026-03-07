import { resolveAgentsPath, fileExists } from '@maestro/core';
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

  console.log('[maestro] Starting orchestrator...\n');

  // Start server first so we have the WebSocket server for broadcasting
  const { server, wss } = startServer(projectRoot);

  // Create the signal dispatcher wired to orchestrator + runners
  const dispatch = createDispatcher({ projectRoot, wss });

  // Start watcher with the dispatcher as signal handler
  const watcher = startWatcher({
    projectRoot,
    onSignal: async (signal: Signal) => {
      console.log(
        `[maestro] Signal received: ${signal.type}` +
          (signal.taskId ? ` (task: ${signal.taskId})` : '')
      );
      try {
        await dispatch(signal);
      } catch (error) {
        console.error(`[maestro] Error handling signal ${signal.type}:`, error);
      }
    },
  });

  console.log('[maestro] Watcher and server are running.');
  console.log('[maestro] Dashboard: http://localhost:7842\n');
  console.log('Press Ctrl+C to stop.\n');

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[maestro] Shutting down...');
    watcher.close();
    server.close(() => {
      console.log('[maestro] Stopped.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
