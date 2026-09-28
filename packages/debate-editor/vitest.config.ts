import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // The optional card-cutter engine never ships here; same stub alias as
      // apps/debate-ai.com/vite.config.ts, so the engine can boot under test.
      "@cardcutter/browser": fileURLToPath(new URL("./src/editor/card-cutter-stub.ts", import.meta.url)),
    },
  },
  test: {
    name: "debate-editor",
    root: import.meta.dirname,
    environment: "jsdom",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
  },
});
