import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "debate-editor",
    root: import.meta.dirname,
    environment: "jsdom",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
  },
});
