import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Monorepo-wide Vitest config, kept here alongside the web app rather than at
 * the repo root so the root stays free of tool configs.
 *
 * Every workspace package under `packages/*` is registered as a project so a
 * single `npm test` (at the root or in this folder) runs each package's
 * `test/` folder, and a single `npm run coverage` produces one merged
 * `coverage/lcov.info` for Codecov to ingest.
 *
 * `root` is pinned to the repo root so the globs below resolve the same way no
 * matter which directory Vitest is invoked from.
 */
const repoRoot = path.resolve(import.meta.dirname, "../..");

export default defineConfig({
  root: repoRoot,
  test: {
    // Exclude packages/README.md, which "packages/*" would otherwise match
    // as a (non-directory, non-config) project entry. Exclude debate-help-docs
    // too: it's a Fumadocs/Next.js site, not a tested library package (like
    // apps/*, which this glob never reaches), and has no test/ folder.
    projects: [
      "packages/*",
      "!packages/README.md",
      "!packages/debate-help-docs",
      // The web app has no test/ folder for the glob above to find, but parts
      // of apps/debate-ai.com/lib are plain Node libraries worth unit testing
      // (the D1 read-replication session wrapper, for one). Registered inline
      // rather than as a path, since the app's only Vitest config is this file.
      {
        test: {
          name: "debate-ai-web",
          environment: "node",
          include: ["apps/debate-ai.com/lib/**/__tests__/**/*.test.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reportsDirectory: path.join(repoRoot, "coverage"),
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
