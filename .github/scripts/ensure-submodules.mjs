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
const SUBMODULES = ["packages/debate-editor-cm", "packages/debate-rankings"];

const missing = SUBMODULES.filter((path) => !existsSync(join(REPO_ROOT, path, "package.json")));
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
