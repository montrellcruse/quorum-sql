import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for server unit tests
 *
 * Run with: npm --prefix server run test
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['tests/integration/**'],
    reporters: ['default', 'verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/migrate.ts',
        'src/seed.ts',
        'src/smoke*.ts',
        'src/types/**',
        'src/**/*.test.ts',
      ],
      thresholds: {
        lines: 40,
        functions: 40,
        branches: 30,
        statements: 40,
      },
    },
  },
});
