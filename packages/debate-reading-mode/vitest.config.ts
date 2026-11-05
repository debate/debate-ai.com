import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@debate-ai/reading-mode",
    root: import.meta.dirname,
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
  },
});
