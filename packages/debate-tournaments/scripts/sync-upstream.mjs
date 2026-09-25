#!/usr/bin/env node
/**
 * Pulls upstream Tabroom (github.com/debate/debate-tournament-tabroom) into
 * this package, with this package's modifications re-applied on top.
 *
 *   node scripts/sync-upstream.mjs              # re-vendor the pinned commit
 *   node scripts/sync-upstream.mjs --latest     # move the pin to upstream's branch head
 *   node scripts/sync-upstream.mjs --ref <sha>  # move the pin to a specific commit
 *   node scripts/sync-upstream.mjs --source ../debate-tournament-tabroom
 *                                               # use a local clone instead of GitHub
 *   node scripts/sync-upstream.mjs --save-patch # record edits made in .upstream/ as a patch
 *   node scripts/sync-upstream.mjs --seed       # also write .upstream-seed.sql (sample data)
 *
 * Steps:
 *  1. `git clone` upstream into `.upstream/` (git-ignored; fetched again on
 *     later runs) and check out the pinned commit from `upstream.json`.
 *  2. Apply `patches/*.patch` with `git apply --3way` — small line edits to
 *     upstream files. If upstream changed the same lines, the conflict is left
 *     in `.upstream/` to resolve; then run `--save-patch` and sync again.
 *  3. Layer `overlays/` on top — whole-file replacements for the modules that
 *     cannot run on Workers (MariaDB pool, Sequelize, winston, config.json).
 *  4. Walk the import graph from `entries` and copy exactly the reachable
 *     files into `vendor/tabroom/`, rewriting `express` and `@tabroom/types`
 *     imports to their in-package targets and marking `.ts` files
 *     `// @ts-nocheck` (upstream is type-checked upstream, not here).
 *  5. Regenerate the D1 migration and the boolean/date column lists from
 *     upstream's schema dump (`scripts/lib/mysql-to-sqlite.mjs`).
 *
 * `vendor/` and `migrations/` are generated — edit `patches/` or `overlays/`
 * instead, so the change survives the next upstream pull.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { booleanColumns, dateColumns, mysqlInsertsToSqlite, parseMysqlTables, tablesToSqlite } from "./lib/mysql-to-sqlite.mjs";

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = join(PKG, "upstream.json");
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const CACHE = join(PKG, ".upstream");
const PATCHES = join(PKG, "patches");
const OVERLAYS = join(PKG, "overlays");
const VENDOR = join(PKG, config.vendorDir);

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
};

const gitRaw = (...args) => execFileSync("git", ["-C", CACHE, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const git = (...args) => gitRaw(...args).trim();
const log = (msg) => console.log(`[sync-upstream] ${msg}`);

// ── 1. clone / fetch ────────────────────────────────────────────────────────
function ensureClone() {
  const source = option("--source") ? resolve(option("--source")) : config.repository;
  if (!existsSync(join(CACHE, ".git"))) {
    log(`cloning ${source}`);
    execFileSync("git", ["clone", "--no-checkout", source, CACHE], { stdio: "inherit" });
  } else {
    git("remote", "set-url", "origin", source);
    log(`fetching ${source}`);
    execFileSync("git", ["-C", CACHE, "fetch", "--quiet", "origin"], { stdio: "inherit" });
  }
}

function resolveCommit() {
  if (option("--ref")) return git("rev-parse", `${option("--ref")}^{commit}`);
  if (flag("--latest")) return git("rev-parse", `origin/${config.branch}`);
  return config.commit;
}

// ── 2. patches ──────────────────────────────────────────────────────────────
const patchFiles = () =>
  existsSync(PATCHES) ? readdirSync(PATCHES).filter((f) => f.endsWith(".patch")).sort().map((f) => join(PATCHES, f)) : [];

function checkoutAndPatch(commit) {
  git("checkout", "--quiet", "--force", commit);
  git("clean", "-fdxq");
  for (const patch of patchFiles()) {
    try {
      git("apply", "--3way", "--whitespace=nowarn", patch);
      log(`applied ${relative(PKG, patch)}`);
    } catch (err) {
      console.error(String(err.stderr || err.message));
      console.error(
        `\n[sync-upstream] ${relative(PKG, patch)} no longer applies cleanly to ${commit.slice(0, 12)}.\n` +
          `Resolve the conflict markers in ${relative(process.cwd(), CACHE)}/, then run:\n` +
          `  node scripts/sync-upstream.mjs --save-patch && node scripts/sync-upstream.mjs\n`,
      );
      process.exit(1);
    }
  }
}

function savePatch() {
  if (!existsSync(join(CACHE, ".git"))) throw new Error("No .upstream/ clone to save a patch from — run a sync first.");
  git("add", "-A");
  // Untrimmed: a patch's last context line can be a lone space.
  const diff = gitRaw("diff", "--cached", "--binary", config.commit);
  git("reset", "--quiet");
  mkdirSync(PATCHES, { recursive: true });
  for (const old of patchFiles()) rmSync(old);
  const target = join(PATCHES, "0001-debate-ai.patch");
  if (diff.trim()) {
    writeFileSync(target, diff);
    log(`wrote ${relative(PKG, target)} (${diff.split("\n").length} lines)`);
  } else {
    log("no changes against the pinned commit; patches/ cleared");
  }
}

// ── 3 + 4. overlays, import graph, vendor ───────────────────────────────────
const overlayPath = (rel) => join(OVERLAYS, rel);
const upstreamPath = (rel) => join(CACHE, rel);
const sourceOf = (rel) => (existsSync(overlayPath(rel)) ? overlayPath(rel) : upstreamPath(rel));
const isFile = (p) => existsSync(p) && statSync(p).isFile();
const exists = (rel) => isFile(overlayPath(rel)) || isFile(upstreamPath(rel));

const IMPORT_RE = /(\b(?:import|export)\b[^'"`;]*?\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"]+)\2/g;

function resolveRelative(fromRel, spec) {
  const base = posix.normalize(posix.join(posix.dirname(fromRel), spec));
  const candidates = [base, base.replace(/\.js$/, ".ts"), base.replace(/\.js$/, ".d.ts"), `${base}.ts`, `${base}.js`, `${base}/index.ts`, `${base}/index.js`];
  return candidates.find((c) => !c.startsWith("..") && exists(c));
}

const packageName = (spec) => spec.split("/").slice(0, spec.startsWith("@") ? 2 : 1).join("/");

function collectGraph() {
  const files = new Set();
  const externals = new Map();
  const missing = [];
  const queue = [...config.entries];
  while (queue.length) {
    const rel = queue.shift();
    if (files.has(rel)) continue;
    files.add(rel);
    const text = readFileSync(sourceOf(rel), "utf8");
    for (const m of text.matchAll(IMPORT_RE)) {
      const spec = m[3];
      if (config.importRewrites[spec]) {
        queue.push(config.importRewrites[spec]);
      } else if (spec.startsWith(".")) {
        const target = resolveRelative(rel, spec);
        if (target) queue.push(target);
        else {
          // Overlays import this package's own src/ — outside the vendored tree.
          const fromVendor = resolve(VENDOR, posix.dirname(rel), spec);
          if (!fromVendor.startsWith(VENDOR)) continue;
          missing.push(`${rel} → ${spec}`);
        }
      } else {
        const name = packageName(spec);
        if (!externals.has(name)) externals.set(name, rel);
      }
    }
  }
  return { files: [...files].sort(), externals, missing };
}

function rewriteImports(rel, text) {
  return text.replace(IMPORT_RE, (whole, head, quote, spec) => {
    const target = config.importRewrites[spec];
    if (!target) return whole;
    let to = posix.relative(posix.dirname(rel), target).replace(/\.ts$/, ".js");
    if (!to.startsWith(".")) to = `./${to}`;
    return `${head}${quote}${to}${quote}`;
  });
}

function writeVendor(files, commit) {
  rmSync(VENDOR, { recursive: true, force: true });
  for (const rel of files) {
    const dest = join(VENDOR, rel);
    mkdirSync(dirname(dest), { recursive: true });
    let text = rewriteImports(rel, readFileSync(sourceOf(rel), "utf8"));
    if (rel.endsWith(".ts") && !text.startsWith("// @ts-nocheck")) text = `// @ts-nocheck\n${text}`;
    writeFileSync(dest, text);
  }
  for (const rel of config.copy ?? []) {
    if (isFile(upstreamPath(rel))) copyFileSync(upstreamPath(rel), join(VENDOR, rel));
  }
  const overlays = listFiles(OVERLAYS).map((p) => relative(OVERLAYS, p).split("\\").join("/"));
  writeFileSync(
    join(VENDOR, "UPSTREAM.json"),
    `${JSON.stringify(
      {
        $comment: "Generated by scripts/sync-upstream.mjs — do not edit files under vendor/ by hand.",
        repository: config.repository,
        commit,
        patches: patchFiles().map((p) => relative(PKG, p)),
        overlays,
        files: files.length,
      },
      null,
      2,
    )}\n`,
  );
}

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(join(dir, e.name)) : [join(dir, e.name)],
  );
}

// ── 5. D1 schema ────────────────────────────────────────────────────────────
function writeSchema(commit) {
  const dump = readFileSync(upstreamPath(config.schemaDump), "utf8");
  const tables = parseMysqlTables(dump);
  const statements = tablesToSqlite(tables, { skipTables: config.skipTables });
  const header = [
    `-- Generated by packages/debate-tournaments/scripts/sync-upstream.mjs from`,
    `-- ${config.repository} @ ${commit}`,
    `-- (${config.schemaDump}). Do not edit — change the converter or upstream instead.`,
    `-- Skipped tables: ${config.skipTables.join(", ") || "none"}.`,
  ].join("\n");
  const migration = join(PKG, config.migration);
  mkdirSync(dirname(migration), { recursive: true });
  writeFileSync(migration, `${header}\n\n${statements.join("\n--> statement-breakpoint\n")}\n`);
  log(`wrote ${config.migration} (${tables.length - config.skipTables.length} tables)`);

  const columns = join(PKG, config.columnsModule);
  mkdirSync(dirname(columns), { recursive: true });
  writeFileSync(
    columns,
    [
      "// Generated by scripts/sync-upstream.mjs from upstream's schema dump. Do not edit.",
      "",
      "/** Columns that are TINYINT(1) — MySQL booleans — in every upstream table that has them. */",
      `export const BOOLEAN_COLUMNS: readonly string[] = ${JSON.stringify(booleanColumns(tables), null, 2)};`,
      "",
      "/** Columns holding DATETIME/TIMESTAMP/DATE values in some upstream table. */",
      `export const DATE_COLUMNS: readonly string[] = ${JSON.stringify(dateColumns(tables), null, 2)};`,
      "",
      "/** Upstream tables created by the D1 migration. */",
      `export const TABLES: readonly string[] = ${JSON.stringify(
        tables.map((t) => t.name).filter((n) => !config.skipTables.includes(n)),
        null,
        2,
      )};`,
      "",
    ].join("\n"),
  );

  if (flag("--seed")) {
    const seedPath = join(PKG, ".upstream-seed.sql");
    const inserts = [...mysqlInsertsToSqlite(dump, { skipTables: config.skipTables })];
    writeFileSync(seedPath, `${inserts.join("\n")}\n`);
    log(`wrote ${relative(PKG, seedPath)} (${inserts.length} insert statements, upstream test data)`);
  }
}

// ── main ────────────────────────────────────────────────────────────────────
if (flag("--save-patch")) {
  savePatch();
  process.exit(0);
}

ensureClone();
const commit = resolveCommit();
log(`upstream commit ${commit}`);
checkoutAndPatch(commit);

const { files, externals, missing } = collectGraph();
for (const m of missing) console.warn(`[sync-upstream] warning: unresolved import ${m}`);
const unexpected = [...externals].filter(([name]) => !config.allowedExternals.includes(name));
for (const [name, from] of unexpected) {
  console.warn(`[sync-upstream] warning: new external dependency "${name}" (imported by ${from}) — add it to package.json and allowedExternals, or overlay the importer`);
}
writeVendor(files, commit);
log(`vendored ${files.length} files into ${config.vendorDir}`);
writeSchema(commit);

if (commit !== config.commit) {
  config.commit = commit;
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
  log(`pinned upstream.json to ${commit}`);
}
if (unexpected.length) process.exitCode = 2;
