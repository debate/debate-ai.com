import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "debate-ai-webui",
    root: import.meta.dirname,
    // The screens are asserted through `react-dom/server`, the same way
    // `debate-timer` asserts its ring — no DOM needed for markup assertions.
    environment: "node",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
  },
});
