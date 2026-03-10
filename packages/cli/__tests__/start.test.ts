import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Unit tests for the `start` command.
 * External packages (@maestro/watcher, @maestro/server, @maestro/orchestrator)
 * are mocked to prevent side effects (file watchers, HTTP servers, etc.).
 */

// Use vi.hoisted so these variables are available at the time vi.mock factories run
const { mockStartWatcher, mockStartServer, mockCreateDispatcher } = vi.hoisted(() => {
  return {
    mockStartWatcher: vi.fn().mockResolvedValue({ close: vi.fn() }),
    mockStartServer: vi.fn().mockReturnValue({
      server: { close: vi.fn((cb: () => void) => cb()) },
      wss: {},
    }),
    mockCreateDispatcher: vi.fn().mockReturnValue(vi.fn()),
  };
});

vi.mock('@maestro/watcher', () => ({
  startWatcher: mockStartWatcher,
}));

vi.mock('@maestro/server', () => ({
  startServer: mockStartServer,
}));

vi.mock('@maestro/orchestrator', () => ({
  createDispatcher: mockCreateDispatcher,
}));

import { startCommand } from '../src/commands/start.js';

describe('start command', () => {
  let tmpDir: string;
  let originalCwd: () => string;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'maestro-start-test-'));
    originalCwd = process.cwd;
    process.cwd = () => tmpDir;
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never);
    vi.clearAllMocks();
    // Re-apply return values after clearAllMocks
    mockStartWatcher.mockResolvedValue({ close: vi.fn() });
    mockStartServer.mockReturnValue({
      server: { close: vi.fn((cb: () => void) => cb()) },
      wss: {},
    });
    mockCreateDispatcher.mockReturnValue(vi.fn());
  });

  afterEach(async () => {
    process.cwd = originalCwd;
    exitSpy.mockRestore();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('exits with code 1 when .ai-agents/ directory does not exist', async () => {
    await expect(startCommand()).rejects.toThrow('process.exit(1)');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('prints an error message when .ai-agents/ does not exist', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(startCommand()).rejects.toThrow('process.exit(1)');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('maestro init')
    );
    errorSpy.mockRestore();
  });

  it('does not start the server when .ai-agents/ is missing', async () => {
    await expect(startCommand()).rejects.toThrow('process.exit(1)');

    expect(mockStartServer).not.toHaveBeenCalled();
  });

  it('does not start the watcher when .ai-agents/ is missing', async () => {
    await expect(startCommand()).rejects.toThrow('process.exit(1)');

    expect(mockStartWatcher).not.toHaveBeenCalled();
  });

  it('starts server, watcher and dispatcher when .ai-agents/ exists', async () => {
    await fs.mkdir(path.join(tmpDir, '.ai-agents'), { recursive: true });

    await startCommand();

    expect(mockStartServer).toHaveBeenCalledWith(tmpDir);
    expect(mockCreateDispatcher).toHaveBeenCalled();
    expect(mockStartWatcher).toHaveBeenCalled();
  });

  it('passes projectRoot to startServer', async () => {
    await fs.mkdir(path.join(tmpDir, '.ai-agents'), { recursive: true });

    await startCommand();

    expect(mockStartServer).toHaveBeenCalledWith(tmpDir);
  });

  it('passes onSignal handler to startWatcher', async () => {
    await fs.mkdir(path.join(tmpDir, '.ai-agents'), { recursive: true });

    await startCommand();

    const watcherCall = mockStartWatcher.mock.calls[0]?.[0];
    expect(watcherCall).toHaveProperty('onSignal');
    expect(typeof watcherCall.onSignal).toBe('function');
  });

  it('registers SIGINT and SIGTERM handlers', async () => {
    await fs.mkdir(path.join(tmpDir, '.ai-agents'), { recursive: true });

    const onSpy = vi.spyOn(process, 'on');

    await startCommand();

    const events = onSpy.mock.calls.map((c) => c[0]);
    expect(events).toContain('SIGINT');
    expect(events).toContain('SIGTERM');

    onSpy.mockRestore();
  });
});
