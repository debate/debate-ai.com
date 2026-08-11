import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "reason-editor",
    root: import.meta.dirname,
    environment: "node",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
  },
});
