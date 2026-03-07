import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Integration tests for the `init` command.
 * Tests run against a real temporary directory to verify that the command
 * creates the expected file/directory structure.
 * The readline interface is mocked to simulate user input.
 */

// Mock readline before importing initCommand so the mock is in place
vi.mock('node:readline/promises', () => ({
  createInterface: vi.fn(),
}));

import * as readlineModule from 'node:readline/promises';
import { initCommand } from '../src/commands/init.js';

function makeReadlineMock(answers: string[]): { question: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> } {
  let callIndex = 0;
  const question = vi.fn().mockImplementation(() => {
    const answer = answers[callIndex] ?? '';
    callIndex++;
    return Promise.resolve(answer);
  });
  const close = vi.fn();
  return { question, close };
}

describe('init command', () => {
  let tmpDir: string;
  let originalCwd: () => string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'maestro-test-'));
    originalCwd = process.cwd;
    process.cwd = () => tmpDir;
  });

  afterEach(async () => {
    process.cwd = originalCwd;
    await fs.rm(tmpDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('creates the .ai-agents/ directory', async () => {
    const mock = makeReadlineMock(['', '', '']);
    vi.mocked(readlineModule.createInterface).mockReturnValue(mock as never);

    await initCommand();

    const agentsDir = path.join(tmpDir, '.ai-agents');
    const stat = await fs.stat(agentsDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('creates all required subdirectories', async () => {
    const mock = makeReadlineMock(['', '', '']);
    vi.mocked(readlineModule.createInterface).mockReturnValue(mock as never);

    await initCommand();

    const expectedDirs = [
      'config',
      'orchestrator',
      'tasks',
      'tasks/in-progress',
      'tasks/done',
      'tasks/blocked',
      'agents',
      'signals',
      'logs',
      'human-queue',
    ];

    for (const dir of expectedDirs) {
      const dirPath = path.join(tmpDir, '.ai-agents', dir);
      const stat = await fs.stat(dirPath);
      expect(stat.isDirectory(), `Expected directory to exist: ${dir}`).toBe(true);
    }
  });

  it('creates config/agents.yaml', async () => {
    const mock = makeReadlineMock(['', '', '']);
    vi.mocked(readlineModule.createInterface).mockReturnValue(mock as never);

    await initCommand();

    const agentsYamlPath = path.join(tmpDir, '.ai-agents', 'config', 'agents.yaml');
    const content = await fs.readFile(agentsYamlPath, 'utf-8');
    expect(content).toContain('agents.yaml');
  });

  it('creates config/project.yaml with user-provided values', async () => {
    const mock = makeReadlineMock(['my-project', 'TypeScript, React', 'ESLint, Prettier']);
    vi.mocked(readlineModule.createInterface).mockReturnValue(mock as never);

    await initCommand();

    const projectYamlPath = path.join(tmpDir, '.ai-agents', 'config', 'project.yaml');
    const content = await fs.readFile(projectYamlPath, 'utf-8');
    expect(content).toContain('my-project');
    expect(content).toContain('TypeScript');
    expect(content).toContain('React');
  });

  it('uses default project name (cwd basename) when user presses Enter', async () => {
    const mock = makeReadlineMock(['', '', '']);
    vi.mocked(readlineModule.createInterface).mockReturnValue(mock as never);

    await initCommand();

    const projectYamlPath = path.join(tmpDir, '.ai-agents', 'config', 'project.yaml');
    const content = await fs.readFile(projectYamlPath, 'utf-8');
    expect(content).toContain(path.basename(tmpDir));
  });

  it('creates orchestrator/plan.md', async () => {
    const mock = makeReadlineMock(['', '', '']);
    vi.mocked(readlineModule.createInterface).mockReturnValue(mock as never);

    await initCommand();

    const planPath = path.join(tmpDir, '.ai-agents', 'orchestrator', 'plan.md');
    const content = await fs.readFile(planPath, 'utf-8');
    expect(content).toContain('Orchestrator Plan');
  });

  it('creates orchestrator/decisions.md', async () => {
    const mock = makeReadlineMock(['', '', '']);
    vi.mocked(readlineModule.createInterface).mockReturnValue(mock as never);

    await initCommand();

    const decisionsPath = path.join(tmpDir, '.ai-agents', 'orchestrator', 'decisions.md');
    const content = await fs.readFile(decisionsPath, 'utf-8');
    expect(content).toContain('Decisions Log');
  });

  it('creates orchestrator/task-graph.json with empty tasks and edges', async () => {
    const mock = makeReadlineMock(['', '', '']);
    vi.mocked(readlineModule.createInterface).mockReturnValue(mock as never);

    await initCommand();

    const taskGraphPath = path.join(tmpDir, '.ai-agents', 'orchestrator', 'task-graph.json');
    const content = JSON.parse(await fs.readFile(taskGraphPath, 'utf-8'));
    expect(content).toEqual({ tasks: [], edges: [] });
  });

  it('creates tasks/backlog.yaml', async () => {
    const mock = makeReadlineMock(['', '', '']);
    vi.mocked(readlineModule.createInterface).mockReturnValue(mock as never);

    await initCommand();

    const backlogPath = path.join(tmpDir, '.ai-agents', 'tasks', 'backlog.yaml');
    const content = await fs.readFile(backlogPath, 'utf-8');
    expect(content).toContain('tasks');
  });

  it('does not overwrite existing files when reinitializing', async () => {
    // First init
    const firstMock = makeReadlineMock(['first-project', '', '']);
    vi.mocked(readlineModule.createInterface).mockReturnValue(firstMock as never);
    await initCommand();

    const projectYamlPath = path.join(tmpDir, '.ai-agents', 'config', 'project.yaml');
    const originalContent = await fs.readFile(projectYamlPath, 'utf-8');

    // Second init — user confirms reinit but files already exist
    const secondMock = makeReadlineMock(['y', 'second-project', '', '']);
    vi.mocked(readlineModule.createInterface).mockReturnValue(secondMock as never);
    await initCommand();

    const newContent = await fs.readFile(projectYamlPath, 'utf-8');
    expect(newContent).toBe(originalContent);
  });

  it('cancels initialization when user declines reinit', async () => {
    // First init to create the directory
    const firstMock = makeReadlineMock(['', '', '']);
    vi.mocked(readlineModule.createInterface).mockReturnValue(firstMock as never);
    await initCommand();

    // Remove project.yaml to track if it gets touched
    const projectYamlPath = path.join(tmpDir, '.ai-agents', 'config', 'project.yaml');
    await fs.rm(projectYamlPath);

    // Second init — user declines reinit
    const secondMock = makeReadlineMock(['n']);
    vi.mocked(readlineModule.createInterface).mockReturnValue(secondMock as never);
    await initCommand();

    // project.yaml should still not exist (init was cancelled)
    const exists = await fs.access(projectYamlPath).then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });
});
