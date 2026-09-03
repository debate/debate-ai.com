import { defineConfig } from "vitest/config";

/**
 * Root Vitest config for the monorepo.
 *
 * Every workspace package under `packages/*` is registered as a project so a
 * single `npm test` at the root runs each package's `test/` folder, and a
 * single `npm run coverage` produces one merged `coverage/lcov.info` for
 * Codecov to ingest.
 */
export default defineConfig({
  test: {
    // Exclude packages/README.md, which "packages/*" would otherwise match
    // as a (non-directory, non-config) project entry.
    projects: ["packages/*", "!packages/README.md"],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "lcov", "html"],
      include: ["packages/*/src/**/*.{ts,tsx}"],
      exclude: [
        "**/*.d.ts",
        "**/node_modules/**",
        "**/test/**",
        // Data assets and generated JSON carry no logic to cover.
        "packages/debate-data-sync/data/**",
        "packages/debate-data-sync/schemas/**",
      ],
    },
  },
});
