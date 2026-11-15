import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Next's tsconfig keeps "jsx": "preserve"; tests need the automatic runtime.
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['test/**/*.spec.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
