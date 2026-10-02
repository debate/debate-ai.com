import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Monorepo-wide Vitest config, kept here alongside the web app rather than at
 * the repo root so the root stays free of tool configs.
 *
 * Every workspace package under `packages/*` is registered as a project, and
 * so are the two apps with tests (this web app and the browser extension), so
 * a single `bun run test` (at the root or in this folder) runs every suite,
 * and a single `bun run coverage` produces one merged `coverage/lcov.info`
 * covering both `packages/` and `apps/` for Codecov to ingest.
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
      // A local, git-ignored clone of upstream Tabroom (the source for
      // @debate/tournaments' sync script); its tests need upstream's own
      // toolchain and MariaDB. @debate/tournaments tests the vendored code.
      "!packages/debate-tournament-tabroom",
      // Git submodules of upstream CardMirror and Tabroom. Each is its own
      // app with its own toolchain and test setup; CardMirror is rebased into
      // @debate/editor (and re-exported by debate-editor-cm-adapter), Tabroom is
      // vendored into debate-tournaments, and those test the parts the app uses.
      "!packages/debate-editor-cm",
      // The browser extension carries its own config (jsdom, its own `@`
      // alias), so it's registered by path and runs under that config.
      "apps/debate-browser-ext",
      // The web app has no test/ folder for the glob above to find, but parts
      // of apps/debate-ai.com/lib are plain Node libraries worth unit testing
      // (the D1 read-replication session wrapper, for one). Registered inline
      // rather than as a path, since the app's only Vitest config is this file.
      {
        // The app's own `@/…` alias, so a lib module under test resolves its
        // imports the same way the app does rather than only under `next build`.
        resolve: {
          alias: {
            "@/": `${path.join(import.meta.dirname, "")}/`,
          },
        },
        test: {
          name: "@debate/ai-web",
          environment: "node",
          // `.tsx` too: the shell's error boundary is only meaningful as a
          // rendered tree, and its regression (a throw failing the *server*
          // render into a 500) is asserted through `react-dom/server`.
          include: ["apps/debate-ai.com/lib/**/__tests__/**/*.test.ts?(x)"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reportsDirectory: path.join(repoRoot, "coverage"),
      reporter: ["text", "lcov", "html"],
      include: [
        "packages/*/src/**/*.{ts,tsx}",
        // The web app's routes, server libraries and Worker entry.
        "apps/debate-ai.com/{app,lib,worker}/**/*.{ts,tsx}",
        // The browser extension's source, entrypoints and UI.
        "apps/debate-browser-ext/{src,lib,entrypoints,components}/**/*.{ts,tsx}",
      ],
      exclude: [
        "**/*.d.ts",
        "**/node_modules/**",
        "**/test/**",
        "**/__tests__/**",
        // Build-time stand-ins for modules the Worker can't load.
        "apps/debate-ai.com/lib/stubs/**",
        // Data assets and generated JSON carry no logic to cover.
        "packages/debate-data-sync/data/**",
        "packages/debate-data-sync/schemas/**",
      ],
    },
  },
});
