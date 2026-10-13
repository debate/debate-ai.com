#!/usr/bin/env bun
/**
 * Audits the Tabroom tables' integrity: orphan ids, rows whose tournament
 * differs from a parent's, duplicate set memberships, and duplicates a
 * nullable unique index lets through (see
 * packages/debate-tournaments/src/db/audit.ts). The schema declares no foreign
 * keys because upstream data breaks them; this measures by how much.
 * Read-only; exits non-zero when it finds anything, so it can gate a job.
 *
 * Usage: bun run .github/scripts/check-tabroom-schema.ts [--local]
 *   (`bun run db:check:tournaments` locally, `db:check:tournaments:d1` remotely)
 */

import { execFileSync } from "node:child_process";
import { auditStatements, type AuditFinding, type AuditKind } from "../../packages/debate-tournaments/src/db/audit";

const DATABASE = process.env.D1_DATABASE_NAME || "debate-ai-db";
const TARGET = process.argv.includes("--local") ? "--local" : "--remote";

const findings: AuditFinding[] = [];
for (const sql of auditStatements()) {
  const output = execFileSync("wrangler", ["d1", "execute", DATABASE, TARGET, "--json", "--command", sql], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const parsed = JSON.parse(output.slice(output.indexOf("[")));
  findings.push(...((parsed[0]?.results ?? []) as AuditFinding[]));
}

const HEADINGS: Record<AuditKind, string> = {
  orphan: "Orphan ids (reference → missing row)",
  ownership: "Tournament mismatches (row's tourn ≠ parent's tourn)",
  "duplicate-membership": "Duplicate set memberships (pairs listed more than once)",
  "nullable-unique": "Duplicates a unique index admits through a NULL column",
};

if (!findings.length) {
  console.log("✓ The Tabroom tables pass every integrity check.");
} else {
  for (const kind of Object.keys(HEADINGS) as AuditKind[]) {
    const rows = findings.filter((f) => f.kind === kind).sort((a, b) => b.count - a.count);
    if (!rows.length) continue;
    console.log(`\n✗ ${HEADINGS[kind]}`);
    for (const f of rows) {
      const where = `${f.table}.${f.columns}`.padEnd(44);
      const note = kind === "orphan" && !f.verified ? "  (unverified reference)" : "";
      console.log(`  ${where} → ${f.target}  ${f.count}${note}`);
    }
  }
  process.exitCode = 1;
}
