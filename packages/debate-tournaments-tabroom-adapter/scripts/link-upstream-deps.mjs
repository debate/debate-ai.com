#!/usr/bin/env node
/**
 * Lets the submodule's sources resolve the dependencies this adapter installs.
 *
 * The workspace uses bun's isolated linker, so `zod`, `prosemirror-model`
 * and the rest land in this package's `node_modules/` only. The files this
 * adapter imports live in `packages/debate-tournaments-tabroom/`, and module resolution
 * walks up from *there* — so without help, a bare import inside the submodule
 * finds nothing. This links `packages/debate-tournaments-tabroom/node_modules` to ours, once per
 * install. The submodule is marked `ignore = untracked` in .gitmodules, so the
 * link never shows up as a change to it.
 *
 * A no-op when the submodule has not been checked out.
 */

import { existsSync, lstatSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const adapterRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const submoduleRoot = resolve(adapterRoot, "../debate-tournaments-tabroom");
const target = join(adapterRoot, "node_modules");
const link = join(submoduleRoot, "node_modules");

if (!existsSync(join(submoduleRoot, "package.json"))) {
  console.warn("[link-upstream-deps] packages/debate-tournaments-tabroom is not checked out — run `git submodule update --init`.");
  process.exit(0);
}

let existing = null;
try {
  existing = lstatSync(link);
} catch {
  // Nothing there yet.
}
// A real node_modules (from installing the submodule on its own) is left alone.
if (existing && !existing.isSymbolicLink()) process.exit(0);
if (existing) rmSync(link);
symlinkSync(relative(submoduleRoot, target), link, "dir");
