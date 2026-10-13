#!/usr/bin/env node
/**
 * Pulls upstream Tabroom (github.com/debate/debate-tournament-tabroom) into
 * this package's submodule at `vendor/tabroom/`, with this package's
 * modifications re-applied on top.
 *
 *   node scripts/sync-upstream.mjs              # re-apply patches to pinned commit
 *   node scripts/sync-upstream.mjs --latest     # move the pin to upstream's branch head
 *   node scripts/sync-upstream.mjs --ref <sha>  # move the pin to a specific commit
 *   node scripts/sync-upstream.mjs --source ../debate-tournament-tabroom
 *                                               # use a local clone instead of GitHub
 *   node scripts/sync-upstream.mjs --save-patch # record edits made in vendor/tabroom/ as a patch
 *   node scripts/sync-upstream.mjs --seed       # also write .upstream-seed.sql (sample data)
 *
 * Steps:
 *  1. Update the submodule at `vendor/tabroom/` to the pinned commit from `upstream.json`.
 *  2. Apply `patches/*.patch` with `git apply --3way` — small line edits to
 *     upstream files. If upstream changed the same lines, the conflict is left
 *     in `vendor/tabroom/` to resolve; then run `--save-patch` and sync again.
 *  3. Layer `overlays/` on top — whole-file replacements for the modules that
 *     cannot run on Workers (MariaDB pool, Sequelize, winston, config.json).
 *  4. Regenerate the D1 migration and the boolean/date column lists from
 *     upstream's schema dump (`scripts/lib/mysql-to-sqlite.mjs`).
 *
 * `vendor/tabroom/` is the submodule — edit `patches/` or `overlays/`
 * instead, so the change survives the next upstream pull.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applySchemaRules,
  booleanColumns,
  dateColumns,
  mysqlInsertsToSqlite,
  parseMysqlTables,
  seedCleanupStatements,
  tablesToSqlite,
  unclassifiedColumns,
} from "./lib/mysql-to-sqlite.mjs";
import { JUNCTIONS } from "./lib/schema-rules.mjs";
import { renderSchemaDoc } from "./lib/schema-doc.mjs";
import { upgradeStatements } from "./lib/schema-upgrade.mjs";

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = join(PKG, "upstream.json");
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const VENDOR = join(PKG, config.vendorDir);
const PATCHES = join(PKG, "patches");
const OVERLAYS = join(PKG, "overlays");

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
};

const gitRaw = (...args) => execFileSync("git", ["-C", VENDOR, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const git = (...args) => gitRaw(...args).trim();
const log = (msg) => console.log(`[sync-upstream] ${msg}`);

// ── 1. update submodule ────────────────────────────────────────────────────────
function ensureSubmodule() {
  if (!existsSync(join(VENDOR, ".git"))) {
    throw new Error(`Submodule not found at ${VENDOR}. Run \`git submodule update --init\` first.`);
  }
  const source = option("--source") ? resolve(option("--source")) : config.repository;
  git("remote", "set-url", "origin", source);
  log(`fetching ${source}`);
  execFileSync("git", ["-C", VENDOR, "fetch", "--quiet", "origin"], { stdio: "inherit" });
}

function resolveCommit() {
  if (option("--ref")) return git("rev-parse", `${option("--ref")}^{commit}`);
  if (flag("--latest")) return git("rev-parse", `origin/${config.branch}`);
  return config.commit;
}

// ── 2. patches ────────────────────────────────────────────────────────────────
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
          `Resolve the conflict markers in ${relative(process.cwd(), VENDOR)}/, then run:\n` +
          `  node scripts/sync-upstream.mjs --save-patch && node scripts/sync-upstream.mjs\n`,
      );
      process.exit(1);
    }
  }
}

function savePatch() {
  if (!existsSync(join(VENDOR, ".git"))) throw new Error("No vendor/tabroom/ submodule to save a patch from — run a sync first.");
  git("add", "-A");
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

// ── 3. overlays ───────────────────────────────────────────────────────────────
const overlayPath = (rel) => join(OVERLAYS, rel);
const vendorPath = (rel) => join(VENDOR, rel);
const isFile = (p) => existsSync(p) && statSync(p).isFile();

function applyOverlays() {
  if (!existsSync(OVERLAYS)) return;
  const files = listFiles(OVERLAYS).map((p) => relative(OVERLAYS, p).split("\\").join("/"));
  for (const rel of files) {
    const src = overlayPath(rel);
    const dest = vendorPath(rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    log(`applied overlay ${rel}`);
  }
}

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(join(dir, e.name)) : [join(dir, e.name)],
  );
}

// ── 4. D1 schema ──────────────────────────────────────────────────────────────
function writeSchema(commit) {
  const dump = readFileSync(vendorPath(config.schemaDump), "utf8");
  const tables = parseMysqlTables(dump);
  const ruled = applySchemaRules(tables);
  const kept = ruled.filter((t) => !config.skipTables.includes(t.name));
  for (const key of unclassifiedColumns(tables, { skipTables: config.skipTables })) {
    console.warn(`[sync-upstream] warning: ${key} looks like a reference but is not in scripts/lib/relationships.mjs (RELATIONSHIPS or SCALARS)`);
  }
  const keptNames = new Set(kept.map((t) => t.name));
  const statements = tablesToSqlite(ruled, { skipTables: config.skipTables });
  const header = [
    `-- Generated by packages/debate-tournaments/scripts/sync-upstream.mjs from`,
    `-- ${config.repository} @ ${commit}`,
    `-- (${config.schemaDump}). Do not edit — change the converter or upstream instead.`,
    `-- Skipped tables: ${config.skipTables.join(", ") || "none"}.`,
  ].join("\n");
  const migration = join(PKG, config.migration);
  mkdirSync(dirname(migration), { recursive: true });
  const previous = existsSync(migration) ? readFileSync(migration, "utf8") : null;
  const next = `${header}\n\n${statements.join("\n--> statement-breakpoint\n")}\n`;
  writeFileSync(migration, next);
  log(`wrote ${config.migration} (${kept.length} tables)`);
  if (previous !== null && previous !== next) writeUpgrade(previous, next, ruled, commit);

  const docPath = join(PKG, config.schemaDoc);
  writeFileSync(docPath, renderSchemaDoc(kept, readFileSync(docPath, "utf8"), { skipTables: config.skipTables }));
  log(`wrote ${relative(PKG, docPath)}`);

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
      "/** Reference columns from `scripts/lib/relationships.mjs`: `table` → `column` → target table and evidence. */",
      `export const REFERENCES: Readonly<Record<string, Readonly<Record<string, { target: string; verified: string | false }>>>> = {\n${kept
        .map((t) => [t.name, t.columns.filter((c) => c.reference && keptNames.has(c.reference))])
        .filter(([, refs]) => refs.length)
        .map(([name, refs]) => `  ${JSON.stringify(name)}: {\n${refs.map((c) => `    ${JSON.stringify(c.name)}: ${JSON.stringify({ target: c.reference, verified: c.verified })},`).join("\n")}\n  },`)
        .join("\n")}\n};`,
      "",
      "/** Public field allowlist per table: every column except credentials and personal contact details. */",
      `export const PUBLIC_COLUMNS: Readonly<Record<string, readonly string[]>> = {\n${kept
        .map((t) => `  ${JSON.stringify(t.name)}: ${JSON.stringify(t.columns.filter((c) => !c.sensitive).map((c) => c.name))},`)
        .join("\n")}\n};`,
      "",
      "/** Column names no table allows publicly, stripped from every API response. */",
      `export const PRIVATE_KEYS: readonly string[] = ${JSON.stringify(
        [...new Set(kept.flatMap((t) => t.columns.filter((c) => c.sensitive).map((c) => c.name)))]
          .filter((name) => kept.every((t) => t.columns.every((c) => c.name !== name || c.sensitive)))
          .sort(),
        null,
        2,
      )};`,
      "",
      "/** Unique indexes with a nullable column: SQLite treats NULLs as distinct, so they admit duplicates. */",
      `export const NULLABLE_UNIQUE_INDEXES: readonly { table: string; index: string; columns: readonly string[] }[] = ${JSON.stringify(
        kept.flatMap((t) =>
          t.indexes
            .filter((ix) => ix.unique && ix.columns.some((name) => !t.columns.find((c) => c.name === name)?.notNull))
            .map((ix) => ({ table: t.name, index: `${t.name}__${ix.name}`, columns: ix.columns })),
        ),
        null,
        2,
      )};`,
      "",
      "/** Set-membership tables whose pair should be unique (`schema-rules.mjs` JUNCTIONS). */",
      `export const JUNCTIONS: Readonly<Record<string, readonly [string, string]>> = ${JSON.stringify(
        Object.fromEntries(Object.entries(JUNCTIONS).filter(([t]) => keptNames.has(t))),
        null,
        2,
      )};`,
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
    const inserts = [
      ...mysqlInsertsToSqlite(dump, { skipTables: config.skipTables }),
      ...seedCleanupStatements(ruled, { skipTables: config.skipTables }),
    ];
    writeFileSync(seedPath, `${inserts.join("\n")}\n`);
    log(`wrote ${relative(PKG, seedPath)} (${inserts.length} insert statements, upstream test data)`);
  }
}

/** Writes `NNNN_tabroom_schema_upgrade.sql`, numbered after the last migration. */
function writeUpgrade(previous, next, tables, commit) {
  const dir = dirname(join(PKG, config.migration));
  const last = Math.max(...readdirSync(dir).map((f) => Number.parseInt(f, 10)).filter(Number.isFinite));
  const name = `${String(last + 1).padStart(4, "0")}_tabroom_schema_upgrade.sql`;
  const header = [
    `-- Generated by packages/debate-tournaments/scripts/sync-upstream.mjs: upgrades a database`,
    `-- that already ran an earlier ${posix.basename(config.migration)} to the one generated from`,
    `-- ${config.repository} @ ${commit}.`,
    `-- Do not edit. It also runs cleanly on a database created from the new schema.`,
  ].join("\n");
  writeFileSync(join(dir, name), `${header}\n\n${upgradeStatements(previous, next, tables).join("\n--> statement-breakpoint\n")}\n`);
  log(`wrote ${relative(PKG, join(dir, name))} (the schema changed)`);
}

// ── 5. add @ts-nocheck to vendor TypeScript files ─────────────────────────────
function addTsNoCheck() {
  const tsFiles = [];
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".ts")) tsFiles.push(full);
    }
  }
  walk(VENDOR);
  for (const file of tsFiles) {
    const text = readFileSync(file, "utf8");
    if (!text.startsWith("// @ts-nocheck")) {
      writeFileSync(file, `// @ts-nocheck\n${text}`);
    }
  }
  log(`added @ts-nocheck to ${tsFiles.length} TypeScript files`);
}

// ── main ──────────────────────────────────────────────────────────────────────
if (flag("--save-patch")) {
  savePatch();
  process.exit(0);
}

ensureSubmodule();
const commit = resolveCommit();
log(`upstream commit ${commit}`);
checkoutAndPatch(commit);
applyOverlays();
addTsNoCheck();

writeSchema(commit);

if (commit !== config.commit) {
  config.commit = commit;
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
  log(`pinned upstream.json to ${commit}`);
}