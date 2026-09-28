import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "debate-rankings-adapter",
    root: import.meta.dirname,
    environment: "node",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
  },
});
