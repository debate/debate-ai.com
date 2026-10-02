import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "debate-predictions",
    root: import.meta.dirname,
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
