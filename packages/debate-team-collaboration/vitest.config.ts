import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@debate-ai/team-collaboration",
    root: import.meta.dirname,
    environment: "node",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
  },
});
