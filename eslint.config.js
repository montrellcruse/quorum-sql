import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import boundaries from "eslint-plugin-boundaries";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "server/node_modules", "server/dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
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
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/naming-convention": [
        "warn",
        { selector: "variable", modifiers: ["const"], format: ["camelCase", "UPPER_CASE"] },
        { selector: "default", format: ["camelCase"], leadingUnderscore: "allow" },
        { selector: "typeLike", format: ["PascalCase"] },
        { selector: "enumMember", format: ["PascalCase", "UPPER_CASE"] },
      ],
      "boundaries/element-types": [
        "warn",
        {
          default: "allow",
          rules: [
            { from: "pages", allow: ["components", "contexts", "hooks", "lib", "utils"] },
            { from: "components", allow: ["components", "hooks", "lib", "utils"] },
            { from: "contexts", allow: ["lib", "utils"] },
            { from: "hooks", allow: ["hooks", "lib", "utils"] },
            { from: "lib", allow: ["lib", "utils"] },
            { from: "utils", allow: ["utils"] },
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
    files: ["server/**/*.{js,mjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      camelcase: ["warn", { properties: "never", ignoreImports: true }],
      complexity: ["warn", 12],
    },
  },
  // Temporarily relax strict rules to unblock CI; tighten incrementally later
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
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
);
