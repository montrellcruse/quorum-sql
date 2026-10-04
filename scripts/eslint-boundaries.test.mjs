import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "eslint";
import tseslint from "typescript-eslint";
import { boundaryRule } from "./eslint-boundaries.mjs";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
const filename = (layer, file = "sample.ts") => path.join(sourceRoot, layer, file);
const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: "module" } });
const allowed = {
  pages: ["components", "contexts", "hooks", "lib", "utils"],
  components: ["components", "hooks", "lib", "utils"],
  contexts: ["lib", "utils"],
  hooks: ["hooks", "lib", "utils"],
  lib: ["lib", "utils"],
  utils: ["utils"],
};

const valid = [{ code: 'import React from "react";', filename: filename("components") }];
const invalid = [];
for (const [from, targets] of Object.entries(allowed)) {
  for (const to of Object.keys(allowed)) {
    const caseData = { code: `import value from "@/${to}/index";`, filename: filename(from) };
    if (targets.includes(to)) valid.push(caseData);
    else invalid.push({ ...caseData, errors: [{ messageId: "dependency" }] });
  }
}

valid.push(
  { code: 'import value from "../../lib";', filename: filename("components", "nested/button.ts") },
  { code: 'export { value } from "@/utils";', filename: filename("hooks") },
  { code: 'import value from "@/integrations/client";', filename: filename("contexts") },
);
invalid.push(
  { code: 'import value from "@/contexts";', filename: filename("components"), errors: [{ messageId: "dependency" }] },
  { code: 'import value from "../contexts";', filename: filename("components"), errors: [{ messageId: "dependency" }] },
  { code: 'export { value } from "@/pages";', filename: filename("utils"), errors: [{ messageId: "dependency" }] },
  { code: 'export * from "../pages/index";', filename: filename("lib"), errors: [{ messageId: "dependency" }] },
  { code: 'const value = import("@/contexts")', filename: filename("components"), errors: [{ messageId: "dependency" }] },
  { code: 'const value = require("../pages")', filename: filename("utils"), errors: [{ messageId: "dependency" }] },
  { code: 'import value from "../../contexts";', filename: filename("components", "nested/button.ts"), errors: [{ messageId: "dependency" }] },
);

tester.run("quorum-boundaries/dependencies", boundaryRule, { valid, invalid });

const typescriptTester = new RuleTester({
  languageOptions: { parser: tseslint.parser, ecmaVersion: 2022, sourceType: "module" },
});
typescriptTester.run("quorum-boundaries/dependencies (TypeScript)", boundaryRule, {
  valid: [
    { code: 'import type { Client } from "@/lib/client";', filename: filename("components") },
    { code: 'export type { Result } from "../utils";', filename: filename("hooks") },
    { code: 'import Types = require("@/lib/types")', filename: filename("contexts") },
  ],
  invalid: [
    { code: 'import type { Session } from "@/contexts";', filename: filename("components"), errors: [{ messageId: "dependency" }] },
    { code: 'export type { Page } from "../pages";', filename: filename("utils"), errors: [{ messageId: "dependency" }] },
    { code: 'import Page = require("@/pages")', filename: filename("utils"), errors: [{ messageId: "dependency" }] },
  ],
});
