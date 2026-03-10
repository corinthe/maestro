import * as path from 'node:path';
import chokidar from 'chokidar';
import { consumeSignal, resolveAgentsPath, ensureDir } from '@maestro/core';
import type { Signal } from '@maestro/core';

export type SignalHandler = (signal: Signal) => Promise<void>;

export interface WatcherOptions {
  projectRoot: string;
  onSignal: SignalHandler;
  usePolling?: boolean;
}

export async function startWatcher(options: WatcherOptions): Promise<chokidar.FSWatcher> {
  const signalsDir = resolveAgentsPath(options.projectRoot, 'signals');
  await ensureDir(signalsDir);

  const watcher = chokidar.watch(path.join(signalsDir, '*.signal'), {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200 },
    usePolling: options.usePolling ?? false,
    ...(options.usePolling ? { interval: 500 } : {}),
  });

  const handleSignal = async (filePath: string) => {
    try {
      const signal = await consumeSignal(filePath);
      await options.onSignal(signal);
    } catch (error) {
      // Signal file may already have been consumed (e.g. rapid add+change for same file)
      const code = (error as { code?: string })?.code;
      if (code === 'ENOENT') return;
      console.error(`[watcher] Error processing signal ${filePath}:`, error);
    }
  };

  watcher.on('add', handleSignal);
  watcher.on('change', handleSignal);

  console.log(`[watcher] Watching signals in ${signalsDir}`);
  return watcher;
}
