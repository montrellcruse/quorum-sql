import path from "node:path";
import { fileURLToPath } from "node:url";

// Keep the project's layer policy without the vulnerable micromatch -> braces tree.
const allowed = {
  pages: new Set(["components", "contexts", "hooks", "lib", "utils"]),
  components: new Set(["components", "hooks", "lib", "utils"]),
  contexts: new Set(["lib", "utils"]),
  hooks: new Set(["hooks", "lib", "utils"]),
  lib: new Set(["lib", "utils"]),
  utils: new Set(["utils"]),
};
const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");

function layer(file, sourceRoot) {
  const relative = path.relative(sourceRoot, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  const [name] = relative.split(path.sep);
  // Directory barrels ("@/contexts" or "../contexts") must classify too.
  return Object.hasOwn(allowed, name) ? name : null;
}

export const boundaryRule = {
  meta: {
    type: "suggestion",
    docs: { description: "Enforce Quorum source-layer dependencies" },
    schema: [],
    messages: {
      dependency: "{{from}} modules must not import {{to}} modules.",
    },
  },
  create(context) {
    const from = layer(context.filename, sourceRoot);
    if (!from) return {};

    function check(node, specifier) {
      if (typeof specifier !== "string") return;
      let resolved;
      if (specifier.startsWith("@/")) {
        resolved = path.resolve(sourceRoot, specifier.slice(2));
      } else if (specifier.startsWith(".")) {
        resolved = path.resolve(path.dirname(context.filename), specifier);
      } else {
        return;
      }
      const to = layer(resolved, sourceRoot);
      if (to && !allowed[from].has(to)) {
        context.report({ node, messageId: "dependency", data: { from, to } });
      }
    }

    return {
      ImportDeclaration(node) { check(node, node.source.value); },
      ExportNamedDeclaration(node) { if (node.source) check(node, node.source.value); },
      ExportAllDeclaration(node) { check(node, node.source.value); },
      ImportExpression(node) { if (node.source.type === "Literal") check(node, node.source.value); },
      CallExpression(node) {
        if (node.callee.name === "require" && node.arguments[0]?.type === "Literal") {
          check(node, node.arguments[0].value);
        }
      },
      TSImportEqualsDeclaration(node) {
        const source = node.moduleReference?.expression;
        if (source?.type === "Literal") check(node, source.value);
      },
    };
  },
};
