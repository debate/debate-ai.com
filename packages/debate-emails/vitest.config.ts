import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@debate-ai/emails",
    root: import.meta.dirname,
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
