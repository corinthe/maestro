import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
  resolve: {
    alias: {
      '@maestro/core': resolve(__dirname, '../core/src/index.ts'),
      '@maestro/orchestrator': resolve(__dirname, '../orchestrator/src/index.ts'),
      '@maestro/watcher': resolve(__dirname, '../watcher/src/index.ts'),
      '@maestro/server': resolve(__dirname, '../server/src/index.ts'),
    },
  },
});
