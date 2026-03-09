import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    root: __dirname,
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});
