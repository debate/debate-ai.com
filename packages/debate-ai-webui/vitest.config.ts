import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // `debate-api-client` publishes from `dist/`, which only exists after its
      // build step. Tests run against its source so a fresh checkout (and CI,
      // which installs without building) can resolve it.
      "debate-api-client": path.resolve(
        import.meta.dirname,
        "../debate-api-client/src/index.ts",
      ),
    },
  },
  test: {
    name: "debate-ai-webui",
    root: import.meta.dirname,
    // The screens are asserted through `react-dom/server`, the same way
    // `debate-timer` asserts its ring — no DOM needed for markup assertions.
    environment: "node",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
  },
});
