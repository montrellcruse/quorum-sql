import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // TypeScript rules - balanced for existing codebase
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', {
        checksVoidReturn: false,  // Allow async in event handlers
      }],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/require-await': 'off',

      // Complexity
      complexity: ['warn', 15],

      // Allow console in CLI tools
      'no-console': 'off',

      // Naming conventions
      '@typescript-eslint/naming-convention': [
        'warn',
        { selector: 'variable', modifiers: ['const'], format: ['camelCase', 'PascalCase', 'UPPER_CASE'] },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        { selector: 'parameter', format: ['camelCase', 'PascalCase'], leadingUnderscore: 'allow' },
        { selector: 'typeLike', format: ['PascalCase'] },
      ],
    },
  },
  // Test files can be more relaxed
  {
    files: ['src/**/*.test.ts', 'tests/**/*.ts', 'tests/**/*.mjs'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  }
);
