import * as path from 'node:path';
import type { Signal } from './types.js';
import { writeYaml, readYaml, resolveAgentsPath } from './file-store.js';
import * as fs from 'node:fs/promises';

export async function emitSignal(projectRoot: string, signal: Signal): Promise<string> {
  const signalsDir = resolveAgentsPath(projectRoot, 'signals');
  await fs.mkdir(signalsDir, { recursive: true });

  const filename = signal.taskId
    ? `${signal.type}-${signal.taskId}.signal`
    : `${signal.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.signal`;

  const filePath = path.join(signalsDir, filename);
  await writeYaml(filePath, signal);
  return filePath;
}

export async function consumeSignal(signalPath: string): Promise<Signal> {
  const signal = await readYaml<Signal>(signalPath);
  await fs.unlink(signalPath);
  return signal;
}
