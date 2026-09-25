import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "debate-ai-webui",
    root: import.meta.dirname,
    // Markup is asserted through `react-dom/server`; the few DOM tests opt in
    // with a `@vitest-environment jsdom` docblock.
    environment: "node",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
  },
});
