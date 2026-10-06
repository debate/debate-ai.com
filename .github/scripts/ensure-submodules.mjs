#!/usr/bin/env node
/**
 * Makes sure the git submodules the web build imports from are checked out,
 * then assembles debate-editor's `src/` from them.
 *
 * A checkout that skips submodules (Cloudflare Workers Builds, or a plain
 * `git clone`) leaves `packages/debate-editor-cm` and `packages/debate-rankings`
 * empty, and the build then fails to resolve `debate-editor/engine`. This
 * fetches them when they are missing and is a no-op when they are present.
 *
 *   node .github/scripts/ensure-submodules.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
// Each submodule with a file that exists only once it is checked out.
// debate-rankings ships no package.json — it is a Python pipeline and its CSVs.
const SUBMODULES = {
  "packages/debate-editor-cm": "package.json",
  "packages/debate-rankings": "config/hspf-config.json",
};

const missing = Object.entries(SUBMODULES)
  .filter(([path, marker]) => !existsSync(join(REPO_ROOT, path, marker)))
  .map(([path]) => path);
if (missing.length > 0) {
  console.log(`Checking out submodules: ${missing.join(", ")}`);
  execFileSync("git", ["submodule", "update", "--init", "--depth", "1", ...missing], {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
}

// debate-editor's exports point into a generated src/ that its postinstall
// skips when the submodule was missing at install time.
execFileSync("node", [join(REPO_ROOT, "packages/debate-editor/scripts/sync-upstream.mjs")], {
  cwd: join(REPO_ROOT, "packages/debate-editor"),
  stdio: "inherit",
});
