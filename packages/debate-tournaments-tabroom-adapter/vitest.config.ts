import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

// The submodule's sources resolve bare imports from their own folder, which
// holds none under bun's isolated linker (CI installs with --ignore-scripts,
// so the postinstall link is not there either). Point each dependency at the
// entry this package resolves, so the submodule and the adapter share one copy.
const { dependencies = {} } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const alias = Object.keys(dependencies).flatMap((name) => {
  try {
    return [{ find: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), replacement: new URL(import.meta.resolve(name)).pathname }];
  } catch {
    // A types-only package (zod-openapi here) has no runtime entry to alias.
    return [];
  }
});

export default defineConfig({
  resolve: { alias },
  test: {
    name: "debate-tournaments-tabroom-adapter",
    root: import.meta.dirname,
    environment: "node",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
  },
});
