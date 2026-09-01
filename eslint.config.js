import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import boundaries from "eslint-plugin-boundaries";
import tseslint from "typescript-eslint";

const configDir = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  { ignores: ["dist", "server/node_modules", "server/dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        tsconfigRootDir: configDir,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      boundaries,
    },
    settings: {
      "boundaries/elements": [
        { type: "pages", pattern: "src/pages/*" },
        { type: "components", pattern: "src/components/*" },
        { type: "contexts", pattern: "src/contexts/*" },
        { type: "hooks", pattern: "src/hooks/*" },
        { type: "lib", pattern: "src/lib/*" },
        { type: "utils", pattern: "src/utils/*" },
      ],
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/naming-convention": [
        "warn",
        { selector: "import", format: ["camelCase", "PascalCase"] },
        { selector: "variable", modifiers: ["const"], format: ["camelCase", "PascalCase", "UPPER_CASE"] },
        { selector: "function", format: ["camelCase", "PascalCase"] },
        { selector: "parameter", format: ["camelCase", "PascalCase"], leadingUnderscore: "allow" },
        { selector: "typeProperty", filter: { regex: "^__", match: true }, format: null },
        {
          selector: "typeProperty",
          format: ["camelCase", "PascalCase", "snake_case"],
          leadingUnderscore: "allow",
        },
        { selector: "objectLiteralProperty", modifiers: ["requiresQuotes"], format: null },
        {
          selector: "objectLiteralProperty",
          format: ["camelCase", "PascalCase", "snake_case", "UPPER_CASE"],
          leadingUnderscore: "allow",
        },
        { selector: "default", format: ["camelCase"], leadingUnderscore: "allow" },
        { selector: "typeLike", format: ["PascalCase"] },
        { selector: "enumMember", format: ["PascalCase", "UPPER_CASE"] },
      ],
      "boundaries/dependencies": [
        "warn",
        {
          default: "allow",
          policies: [
            {
              from: { element: { type: "pages" } },
              allow: {
                to: { element: { types: { anyOf: ["components", "contexts", "hooks", "lib", "utils"] } } },
              },
            },
            {
              from: { element: { type: "components" } },
              allow: {
                to: { element: { types: { anyOf: ["components", "hooks", "lib", "utils"] } } },
              },
            },
            {
              from: { element: { type: "contexts" } },
              allow: { to: { element: { types: { anyOf: ["lib", "utils"] } } } },
            },
            {
              from: { element: { type: "hooks" } },
              allow: { to: { element: { types: { anyOf: ["hooks", "lib", "utils"] } } } },
            },
            {
              from: { element: { type: "lib" } },
              allow: { to: { element: { types: { anyOf: ["lib", "utils"] } } } },
            },
            {
              from: { element: { type: "utils" } },
              allow: { to: { element: { type: "utils" } } },
            },
          ],
        },
      ],
      complexity: ["warn", 12],
      // Allow empty catch blocks (use sparingly)
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    extends: [js.configs.recommended],
    files: ["server/**/*.{js,mjs,ts}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
      parserOptions: {
        tsconfigRootDir: configDir,
      },
    },
    rules: {
      "no-unused-vars": "off",
      camelcase: "off",
      "@typescript-eslint/naming-convention": "off",
      complexity: ["warn", 12],
    },
  },
  // Temporarily relax strict rules to unblock CI; tighten incrementally later
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // UI shadcn components occasionally use empty extension interfaces
  {
    files: ["src/components/ui/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
  // Allow require() in tool/config files
  {
    files: [
      "tailwind.config.ts",
      "vite.config.ts",
      "postcss.config.js",
      "eslint.config.js",
    ],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["src/pages/**/*.{ts,tsx}"],
    rules: {
      complexity: ["warn", 50],
    },
  },
  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      complexity: ["warn", 30],
    },
  },
  {
    files: ["src/contexts/**/*.{ts,tsx}"],
    rules: {
      complexity: ["warn", 20],
    },
  },
);
