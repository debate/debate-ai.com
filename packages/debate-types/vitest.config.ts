import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@types/debate",
    root: import.meta.dirname,
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
