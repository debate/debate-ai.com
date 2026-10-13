/**
 * The Tabroom tables declare no foreign keys: upstream's data has orphan rows,
 * and D1 would reject them. This builds the SQL that counts them instead, one
 * row per reference column with at least one orphan, for
 * `bun run db:check:tournaments` (`.github/scripts/check-tabroom-orphans.ts`).
 */
import { REFERENCES } from "./generated/columns";

export interface OrphanCount {
  table: string;
  column: string;
  target: string;
  orphans: number;
}

const q = (id: string) => `"${id.replace(/"/g, '""')}"`;

/**
 * `SELECT table, column, target, orphans` statements over every reference
 * column, in chunks of `perStatement` (SQLite caps a compound SELECT at 500
 * terms). A NULL reference means "none" and is not an orphan.
 */
export function orphanCheckStatements(references = REFERENCES, perStatement = 100): string[] {
  const terms = Object.entries(references).flatMap(([table, columns]) =>
    Object.entries(columns).map(
      ([column, target]) =>
        `SELECT '${table}' AS "table", '${column}' AS "column", '${target}' AS "target", COUNT(*) AS orphans ` +
        `FROM ${q(table)} AS t WHERE t.${q(column)} IS NOT NULL ` +
        `AND NOT EXISTS (SELECT 1 FROM ${q(target)} AS r WHERE r."id" = t.${q(column)}) HAVING COUNT(*) > 0`,
    ),
  );
  const statements: string[] = [];
  for (let i = 0; i < terms.length; i += perStatement) statements.push(terms.slice(i, i + perStatement).join("\nUNION ALL\n"));
  return statements;
}
