import { defineConfig } from 'vitest/config';

const useJunit = process.env.CI === 'true' || process.env.VITEST_JUNIT === '1';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    reporters: useJunit ? ['default', 'verbose', 'junit'] : ['default', 'verbose'],
    outputFile: useJunit ? { junit: 'test-results/vitest.xml' } : undefined,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'src/lib/featureFlags.ts',
        'src/utils/email.ts',
        'src/utils/errors.ts',
        'src/utils/terminology.ts',
        'src/hooks/use-toast.ts',
      ],
      exclude: [
        'src/lib/monacoSetup.ts',
        'src/utils/teamUtils.ts',
        'src/**/*.test.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 50,
        branches: 50,
        statements: 70,
      },
    },
  },
});
