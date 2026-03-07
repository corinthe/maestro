import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as yaml from 'js-yaml';

const AI_AGENTS_DIR = '.ai-agents';

export function resolveAgentsPath(projectRoot: string, ...segments: string[]): string {
  return path.join(projectRoot, AI_AGENTS_DIR, ...segments);
}

export async function readYaml<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  return yaml.load(content) as T;
}

export async function writeYaml(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const content = yaml.dump(data, { lineWidth: 120 });
  await fs.writeFile(filePath, content, 'utf-8');
}

export async function readJson<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

export async function readMarkdown(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8');
}

export async function writeMarkdown(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
