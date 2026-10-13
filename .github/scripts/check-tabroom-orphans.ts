#!/usr/bin/env bun
/**
 * Reports orphan rows in the Tabroom tables: reference columns holding an id
 * that its table does not have. The schema declares no foreign keys (upstream
 * data has orphans, and D1 enforces them), so this is the integrity check.
 * Read-only; exits non-zero when it finds any, so it can gate a job.
 *
 * Usage: bun run .github/scripts/check-tabroom-orphans.ts [--local]
 *   (`bun run db:check:tournaments` locally, `db:check:tournaments:d1` remotely)
 */

import { execFileSync } from "node:child_process";
import { orphanCheckStatements, type OrphanCount } from "../../packages/debate-tournaments/src/db/orphans";

const DATABASE = process.env.D1_DATABASE_NAME || "debate-ai-db";
const TARGET = process.argv.includes("--local") ? "--local" : "--remote";

const orphans: OrphanCount[] = [];
for (const sql of orphanCheckStatements()) {
  const output = execFileSync("wrangler", ["d1", "execute", DATABASE, TARGET, "--json", "--command", sql], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const parsed = JSON.parse(output.slice(output.indexOf("[")));
  orphans.push(...((parsed[0]?.results ?? []) as OrphanCount[]));
}

if (!orphans.length) {
  console.log("✓ No orphan rows in the Tabroom tables.");
} else {
  orphans.sort((a, b) => b.orphans - a.orphans);
  console.log(`✗ ${orphans.length} reference column(s) hold ids their table does not have:\n`);
  for (const o of orphans) console.log(`  ${`${o.table}.${o.column}`.padEnd(40)} → ${o.target}.id  ${o.orphans}`);
  process.exitCode = 1;
}
