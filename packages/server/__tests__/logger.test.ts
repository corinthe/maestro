import { describe, it, expect, beforeEach } from 'vitest';
import { appendLog, getLogs, clearLogs } from '../src/logger.js';

beforeEach(() => {
  clearLogs();
});

describe('appendLog', () => {
  it('stores log entries', () => {
    appendLog({ timestamp: '2024-01-01T00:00:00Z', agent: 'test', level: 'info', message: 'hello' });
    expect(getLogs()).toHaveLength(1);
    expect(getLogs()[0].message).toBe('hello');
  });

  it('caps at MAX_IN_MEMORY_LOGS', () => {
    for (let i = 0; i < 2100; i++) {
      appendLog({ timestamp: `ts-${i}`, agent: 'test', level: 'info', message: `msg-${i}` });
    }
    expect(getLogs().length).toBeLessThanOrEqual(2000);
  });
});
