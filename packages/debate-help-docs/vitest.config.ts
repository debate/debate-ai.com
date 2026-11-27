import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@debate-ai/help-docs",
    root: import.meta.dirname,
    // Components are mounted with react-dom in jsdom (each test file opts in
    // with a `@vitest-environment jsdom` docblock).
    environment: "node",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
  },
});
