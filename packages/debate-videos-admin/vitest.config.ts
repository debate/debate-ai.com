import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@debate-ai/videos-admin",
    root: import.meta.dirname,
    // The admin panels and route handlers run under jsdom, as they did in the
    // admin packages they came from; the sync scripts and SQL builders opt into
    // Node with a `@vitest-environment node` docblock.
    environment: "jsdom",
    globals: true,
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      // The /api/admin handlers import the web app's auth, D1 and job modules
      // through its `@/` root alias, as the app's own route files do.
      "@": path.resolve(import.meta.dirname, "../../apps/debate-web"),
    },
  },
});
