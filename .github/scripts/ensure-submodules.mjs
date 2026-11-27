#!/usr/bin/env node
/**
 * Makes sure the workspace is installed and the git submodules the web build
 * imports from are checked out, then assembles debate-editor's `src/` from them.
 *
 * A checkout that skips submodules (Cloudflare Workers Builds, or a plain
 * `git clone`) leaves `packages/debate-editor-cm` and `packages/debate-rankings-sync-data`
 * empty, and the build then fails to resolve `debate-editor/engine`. This
 * fetches them when they are missing and is a no-op when they are present.
 *
 * It also catches a stale `node_modules`: after a `git pull` that adds a
 * `workspace:*` dependency (e.g. help-docs -> @debate-ai/videos) the symlink is
 * missing until `bun install` reruns, and the bundler fails with
 * `Rolldown failed to resolve import "@debate-ai/videos/page-flow-chart"`.
 * The install is run here rather than leaving that error to be decoded.
 *
 *   node .github/scripts/ensure-submodules.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findMissingWorkspaceLinks } from "./workspace-links.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
// Each submodule with a file that exists only once it is checked out.
// debate-rankings-sync-data ships no package.json — it is a Python pipeline and its CSVs.
const SUBMODULES = {
  "packages/debate-editor-cm": "package.json",
  "packages/debate-rankings-sync-data": "config/hspf-config.json",
};

const missingLinks = findMissingWorkspaceLinks(REPO_ROOT);
if (missingLinks.length > 0) {
  const list = missingLinks.map(({ workspace, dependency }) => `${workspace} -> ${dependency}`).join(", ");
  console.log(`node_modules is out of date (missing workspace links: ${list}); running bun install`);
  try {
    execFileSync("bun", ["install"], { cwd: REPO_ROOT, stdio: "inherit" });
  } catch (error) {
    console.error("`bun install` failed or bun is not installed; run it from the repo root and retry.");
    throw error;
  }
}

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
