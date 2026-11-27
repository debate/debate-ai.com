/**
 * Helpers that check the monorepo's `@debate-ai/*` workspace wiring.
 *
 * Used by `ensure-submodules.mjs` (the web build's preflight) to notice a stale
 * `node_modules` — a package gained a `workspace:*` dependency after the last
 * `bun install`, so its symlink is missing and the bundler fails with
 * `Rolldown failed to resolve import "@debate-ai/videos/page-flow-chart"` — and
 * by the `workspace-imports` test to check, without an install, that every
 * `@debate-ai/*` import in the repo is declared and exported.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const DEP_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/;
const SKIPPED_DIRS = new Set(["node_modules", "dist", ".next", ".turbo", ".source", "coverage", ".git", ".wrangler"]);
// Vendored upstream trees (submodules and the assembled editor src/) are not ours to lint.
const SKIPPED_PATHS = new Set([
  "packages/debate-editor-cm",
  "packages/debate-editor/src",
  "packages/debate-tournaments-tabroom",
  "packages/debate-rankings-sync-data",
]);

const FILE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"];

// Imports that bypass node_modules on purpose: the native wrapper is built outside the
// workspace install and aliases the package to its folder (see its vitest.config.ts and
// scripts/build-offline.mjs), so it does not declare it.
const ALIASED_IMPORTS = new Set(["apps/debate-native-wrapper|@debate-ai/webview"]);

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

/** Every workspace under `packages/*` and `apps/*` that has a package.json (submodules without one are skipped). */
export function listWorkspaces(repoRoot) {
  const workspaces = [];
  for (const group of ["packages", "apps"]) {
    const groupDir = join(repoRoot, group);
    if (!existsSync(groupDir)) continue;
    for (const entry of readdirSync(groupDir, { withFileTypes: true })) {
      const dir = join(groupDir, entry.name);
      const manifestPath = join(dir, "package.json");
      if (!entry.isDirectory() || !existsSync(manifestPath)) continue;
      if (SKIPPED_PATHS.has(`${group}/${entry.name}`)) continue;
      workspaces.push({ dir, rel: `${group}/${entry.name}`, manifest: readJson(manifestPath) });
    }
  }
  return workspaces;
}

const workspaceDeps = (manifest) =>
  DEP_FIELDS.flatMap((field) => Object.entries(manifest[field] ?? {}))
    .filter(([, spec]) => String(spec).startsWith("workspace:"))
    .map(([name]) => name);

/**
 * `workspace:*` dependencies whose symlink is absent from `node_modules` — what
 * a `git pull` that adds a dependency leaves behind until `bun install` reruns.
 */
export function findMissingWorkspaceLinks(repoRoot) {
  const missing = [];
  for (const { dir, rel, manifest } of listWorkspaces(repoRoot)) {
    for (const name of new Set(workspaceDeps(manifest))) {
      const linked = [join(dir, "node_modules", name), join(repoRoot, "node_modules", name)].some(existsSync);
      if (!linked) missing.push({ workspace: rel, dependency: name });
    }
  }
  return missing;
}

function* walkSources(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIPPED_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkSources(path);
    else if (SOURCE_FILE.test(entry.name) && !entry.name.endsWith(".d.ts")) yield path;
  }
}

const IMPORT_SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*|\bvi\.(?:mock|importActual)\s*\(\s*)["'](@debate-ai\/[^"']+)["']/g;

/** Every `@debate-ai/*` specifier imported by the workspace's own source files. */
export function collectDebateAiImports(workspace, repoRoot) {
  const found = [];
  for (const file of walkSources(workspace.dir)) {
    if (SKIPPED_PATHS.has(relative(repoRoot, file).split("/").slice(0, 3).join("/"))) continue;
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(IMPORT_SPECIFIER)) {
      found.push({ file: relative(repoRoot, file), specifier: match[1] });
    }
  }
  return found;
}

export const splitSpecifier = (specifier) => {
  const [scope, name, ...rest] = specifier.split("/");
  return { packageName: `${scope}/${name}`, subpath: rest.length ? `./${rest.join("/")}` : "." };
};

const isFile = (path) => existsSync(path) && statSync(path).isFile();

/** A target as written, then with each extension and `/index` extension a bundler probes when the target omits one. */
const withExtensions = (target) => [
  target,
  ...FILE_EXTENSIONS.map((ext) => `${target}${ext}`),
  ...FILE_EXTENSIONS.map((ext) => `${target}/index${ext}`),
];

/** Files an `exports` map could serve for `subpath` (all array fallbacks, `*` expanded), or `null` when no key matches. */
export function exportCandidates(exportsField, subpath, manifest = {}) {
  if (!exportsField) {
    if (subpath === ".") return [manifest.main ?? manifest.module ?? "index.js"];
    return withExtensions(subpath);
  }
  if (typeof exportsField === "string") exportsField = { ".": exportsField };
  let best = null;
  for (const [key, target] of Object.entries(exportsField)) {
    if (key === subpath) {
      best = { key, wildcard: null, target };
      break;
    }
    const star = key.indexOf("*");
    if (star === -1) continue;
    const prefix = key.slice(0, star);
    const suffix = key.slice(star + 1);
    if (subpath.length >= key.length - 1 && subpath.startsWith(prefix) && subpath.endsWith(suffix)) {
      if (!best || prefix.length > best.key.indexOf("*")) {
        best = { key, wildcard: subpath.slice(prefix.length, subpath.length - suffix.length), target };
      }
    }
  }
  if (!best) return null;
  const targets = Array.isArray(best.target) ? best.target : [best.target];
  const strings = targets.flatMap((target) => {
    if (typeof target === "string") return [target];
    if (target && typeof target === "object") return Object.values(target).filter((value) => typeof value === "string");
    return [];
  });
  return strings.flatMap((target) => withExtensions(best.wildcard === null ? target : target.replaceAll("*", best.wildcard)));
}

/**
 * Imports of `@debate-ai/*` subpaths that cannot resolve: the importing package
 * does not declare the dependency, the target package has no matching `exports`
 * entry, or the entry points at a file that does not exist.
 */
export function findUnresolvableImports(repoRoot) {
  const workspaces = listWorkspaces(repoRoot);
  const byName = new Map(workspaces.map((workspace) => [workspace.manifest.name, workspace]));
  const problems = [];
  for (const workspace of workspaces) {
    const declared = new Set(DEP_FIELDS.flatMap((field) => Object.keys(workspace.manifest[field] ?? {})));
    const seen = new Set();
    for (const { file, specifier } of collectDebateAiImports(workspace, repoRoot)) {
      const key = `${file}\0${specifier}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const { packageName, subpath } = splitSpecifier(specifier);
      const target = byName.get(packageName);
      if (!target) continue; // not a workspace package (a published @debate-ai/* dependency)
      if (
        packageName !== workspace.manifest.name &&
        !declared.has(packageName) &&
        !ALIASED_IMPORTS.has(`${workspace.rel}|${packageName}`)
      ) {
        problems.push({ file, specifier, reason: `${workspace.rel}/package.json does not declare ${packageName}` });
        continue;
      }
      const candidates = exportCandidates(target.manifest.exports, subpath, target.manifest);
      if (candidates === null) {
        problems.push({ file, specifier, reason: `${target.rel}/package.json has no "exports" entry for ${subpath}` });
      } else if (!candidates.some((candidate) => isFile(join(target.dir, candidate)))) {
        problems.push({
          file,
          specifier,
          reason: `"exports" of ${target.rel} maps ${subpath} to ${candidates[0]}, which does not exist`,
        });
      }
    }
  }
  return problems;
}
