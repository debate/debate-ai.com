/**
 * @fileoverview Builds the help docs and stages them at `public/docs`, so the
 * deployed app serves them at `debate-ai.com/docs`.
 *
 * `packages/debate-help-docs` is its own Next app, statically exported
 * (`output: 'export'`) under `basePath: '/docs'` — every page is prerendered,
 * so the whole site is a folder of files with no server behind it. Copying
 * that folder into this app's `public/docs` is all it takes to publish: the
 * Worker's static-asset binding (`assets.directory` in wrangler.jsonc, which
 * is where `public/` lands after a build) answers `/docs/...` before the
 * request ever reaches the app's own router.
 *
 * The export is build output, not source, so `public/docs` is gitignored and
 * rebuilt here on every `npm run build`. Set `SKIP_DOCS_BUILD=1` to reuse an
 * existing `out/` — useful when iterating on the app with the docs unchanged.
 *
 * @module scripts/build-docs
 */

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(appDir, "..", "..");
const docsDir = resolve(repoRoot, "packages/debate-help-docs");
const exportDir = join(docsDir, "out");
const targetDir = join(appDir, "public", "docs");

/**
 * Locates the docs package's own `next` binary, or `null` when its
 * dependencies are not installed.
 *
 * Resolved from the docs package rather than run through a package manager:
 * this has to work the same under bun, npm, and Cloudflare Workers Builds.
 * A fresh `createRequire` per call keeps a failed lookup from being answered
 * out of a stale resolution cache after {@link installWorkspaceDeps} runs.
 */
function resolveNextBin() {
  try {
    return createRequire(join(docsDir, "package.json")).resolve("next/dist/bin/next");
  } catch {
    return null;
  }
}

/**
 * Installs the workspace's dependencies from the repo root.
 *
 * Cloudflare Workers Builds runs with `SKIP_DEPENDENCY_INSTALL` and a restored
 * dependency cache, and bun's isolated linker gives every workspace its own
 * `node_modules` instead of hoisting one copy to the repo root. A workspace
 * added after that cache was written therefore arrives with no `node_modules`
 * at all and nothing to fill it in, which is what left `next` unresolvable
 * here. Installing on demand fixes up exactly that case and is a no-op on a
 * machine where the deps are already present.
 */
function installWorkspaceDeps() {
  const usesBun =
    existsSync(join(repoRoot, "bun.lock")) || existsSync(join(repoRoot, "bun.lockb"));
  const command = usesBun ? "bun" : "npm";

  console.info(
    `build-docs: debate-help-docs has no dependencies installed; running \`${command} install\``,
  );

  const result = spawnSync(command, ["install"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`\`${command} install\` failed with exit code ${result.status}`);
  }
}

/** Runs the docs package's own `next build`, which writes `out/`. */
function buildDocs() {
  let nextBin = resolveNextBin();

  if (!nextBin) {
    installWorkspaceDeps();
    nextBin = resolveNextBin();
  }

  if (!nextBin) {
    throw new Error(
      `Cannot resolve next from ${docsDir}. Install the workspace dependencies (\`bun install\` at the repo root) and try again.`,
    );
  }

  const result = spawnSync(process.execPath, [nextBin, "build"], {
    cwd: docsDir,
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`debate-help-docs build failed with exit code ${result.status}`);
  }
}

if (process.env.SKIP_DOCS_BUILD === "1" && existsSync(exportDir)) {
  console.info("build-docs: SKIP_DOCS_BUILD=1, reusing the existing export");
} else {
  console.info("build-docs: building debate-help-docs…");
  buildDocs();
}

if (!existsSync(exportDir)) {
  throw new Error(`debate-help-docs produced no export at ${exportDir}`);
}

// A stale page left behind by a rename would still be served, so replace the
// staged copy wholesale rather than merging into it.
rmSync(targetDir, { recursive: true, force: true });
mkdirSync(dirname(targetDir), { recursive: true });
cpSync(exportDir, targetDir, { recursive: true });

console.info(`build-docs: staged the docs at ${targetDir} (served at /docs)`);
