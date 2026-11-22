import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "school-rank",
    root: import.meta.dirname,
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
