/**
 * @file Build-time scan of the monorepo's packages for the developer docs'
 * code graphs (`dev-docs/packages/*`).
 *
 * The site runs on Cloudflare Workers, which has no filesystem, so the
 * scanning that code-tree-graph's `DependencyGraph` / `FileTreeView` server
 * components do on every render happens here instead, once, from the Vite
 * plugin in `vite.mjs`. Each package's tree becomes a lazily loaded client
 * chunk that `components/code-graph` renders.
 *
 * Scanner vendored from code-tree-graph (github.com/OpenSourceAGI/dev-tools-starter-agent,
 * `packages/code-tree-graph/lib`); its published `dist` stubs out `fs`, so
 * the npm build can't scan.
 */
import fs from "fs";
import path from "path";
import { applyDescriptions, scanDir } from "./scan";
import type { FileTreeNode } from "./types";

export type { FileTreeNode } from "./types";

/** Skipped in every package: tests, build output, generated folders. */
const IGNORE_EVERYWHERE = ["node_modules", "dist", "coverage", "test", "tests", "__tests__", ".source"];

/**
 * Extra folders to skip per package directory, where scanning everything
 * would bury the package's code.
 */
const IGNORE_BY_PACKAGE: Record<string, string[]> = {
  // Hundreds of MDX pages, not code.
  "debate-help-docs": ["content", "dev-docs"],
  // `src/` is assembled on install from the upstream submodule plus
  // `overlay/` and is git-ignored; the package's own files are the rest.
  "debate-editor": ["src"],
};

/** A package the dev docs draw a code graph for. */
export interface CodeGraphPackage {
  /** Directory under `packages/`, which is also the dev-docs page slug. */
  dir: string;
  /** npm name from its `package.json`. */
  name: string;
}

/**
 * Every workspace package under `packagesRoot` that the dev docs cover: the
 * ones published as `@debate-ai/*`. Git submodules of upstream projects
 * (`debate-editor-cm`, `debate-tournaments-tabroom`, `debate-rankings-sync-data`)
 * are not ours and are left out.
 */
export function listCodeGraphPackages(packagesRoot: string): CodeGraphPackage[] {
  const result: CodeGraphPackage[] = [];
  for (const entry of fs.readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgJson = path.join(packagesRoot, entry.name, "package.json");
    if (!fs.existsSync(pkgJson)) continue;
    try {
      const { name } = JSON.parse(fs.readFileSync(pkgJson, "utf8")) as { name?: string };
      if (name?.startsWith("@debate-ai/")) result.push({ dir: entry.name, name });
    } catch {
      // Unreadable package.json: not a package we can describe.
    }
  }
  return result.sort((a, b) => a.dir.localeCompare(b.dir));
}

/**
 * Scan one package into a file tree with per-file analysis (imports, exports,
 * functions, types) and descriptions inferred from each file's leading JSDoc.
 */
export function scanPackage(packagesRoot: string, dir: string): FileTreeNode[] {
  const root = path.join(packagesRoot, dir);
  const ignore = new Set([...IGNORE_EVERYWHERE, ...(IGNORE_BY_PACKAGE[dir] ?? [])]);
  return applyDescriptions(scanDir(root, root, ignore), {}, root, true);
}
