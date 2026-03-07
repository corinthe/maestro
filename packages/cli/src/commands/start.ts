import { resolveAgentsPath, fileExists } from '@maestro/core';
import { startWatcher } from '@maestro/watcher';
import { startServer } from '@maestro/server';
import type { Signal } from '@maestro/core';

export async function startCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const agentsRoot = resolveAgentsPath(projectRoot);

  if (!(await fileExists(agentsRoot))) {
    console.error('No .ai-agents/ directory found. Run `maestro init` first.');
    process.exit(1);
  }

  console.log('[maestro] Starting orchestrator...\n');

  // Start watcher and server in parallel
  const watcher = startWatcher({
    projectRoot,
    onSignal: async (signal: Signal) => {
      console.log(`[maestro] Signal received: ${signal.type}${signal.taskId ? ` (task: ${signal.taskId})` : ''}`);
    },
  });

  const { server } = startServer(projectRoot);

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
