import * as path from 'node:path';
import chokidar from 'chokidar';
import { consumeSignal, resolveAgentsPath } from '@maestro/core';
import type { Signal } from '@maestro/core';

export type SignalHandler = (signal: Signal) => Promise<void>;

export interface WatcherOptions {
  projectRoot: string;
  onSignal: SignalHandler;
}

export function startWatcher(options: WatcherOptions): chokidar.FSWatcher {
  const signalsDir = resolveAgentsPath(options.projectRoot, 'signals');

  const watcher = chokidar.watch(path.join(signalsDir, '*.signal'), {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200 },
  });

  watcher.on('add', async (filePath: string) => {
    try {
      const signal = await consumeSignal(filePath);
      await options.onSignal(signal);
    } catch (error) {
      console.error(`[watcher] Error processing signal ${filePath}:`, error);
    }
  });

  console.log(`[watcher] Watching signals in ${signalsDir}`);
  return watcher;
}
