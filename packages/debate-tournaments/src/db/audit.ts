/**
 * Integrity checks for the Tabroom tables, for `bun run db:check:tournaments`
 * (`.github/scripts/check-tabroom-schema.ts`). The schema declares no foreign
 * keys or extra unique constraints, because upstream's data breaks them; these
 * measure by how much, so a constraint can be added once its count is zero.
 *
 * Every check is driven by the registries the generator writes into
 * `generated/columns.ts` (from `scripts/lib/relationships.mjs` and
 * `schema-rules.mjs`), never by column names:
 *
 *  - `orphan`: a reference column holding an id its target table lacks;
 *  - `ownership`: a row whose `tourn` differs from the `tourn` of a parent it
 *    references (e.g. an entry in one tournament pointing at another's event);
 *  - `duplicate-membership`: a set-membership pair (`JUNCTIONS`) listed twice;
 *  - `nullable-unique`: rows a unique index should reject but admits because
 *    one of its columns is NULL (SQLite treats NULLs as distinct).
 */
import { JUNCTIONS, NULLABLE_UNIQUE_INDEXES, REFERENCES } from "./generated/columns";

export type AuditKind = "orphan" | "ownership" | "duplicate-membership" | "nullable-unique";

/** One finding: `count` offending rows (or duplicate groups) for `table`.`columns`. */
export interface AuditFinding {
  kind: AuditKind;
  table: string;
  columns: string;
  /** The referenced table, the parent compared against, or the index name. */
  target: string;
  /** Whether the reference is verified (orphan/ownership); 1 or 0. */
  verified: number;
  count: number;
}

const q = (id: string) => `"${id.replace(/"/g, '""')}"`;
const lit = (text: string) => `'${text.replace(/'/g, "''")}'`;

function row(kind: AuditKind, table: string, columns: string, target: string, verified: boolean) {
  return `SELECT ${lit(kind)} AS kind, ${lit(table)} AS "table", ${lit(columns)} AS columns, ${lit(target)} AS target, ${verified ? 1 : 0} AS verified`;
}

/** Every check, one compound-SELECT term each, returning a row only when it finds something. */
export function auditTerms(references = REFERENCES): string[] {
  const terms: string[] = [];
  for (const [table, columns] of Object.entries(references)) {
    for (const [column, { target, verified }] of Object.entries(columns)) {
      terms.push(
        `${row("orphan", table, column, target, Boolean(verified))}, COUNT(*) AS count FROM ${q(table)} AS t ` +
          `WHERE t.${q(column)} IS NOT NULL AND t.${q(column)} <> 0 ` +
          `AND NOT EXISTS (SELECT 1 FROM ${q(target)} AS r WHERE r."id" = t.${q(column)}) HAVING COUNT(*) > 0`,
      );
    }
    // Ownership: this row's tourn against the tourn of each parent that has one.
    const own = columns.tourn;
    if (own?.target === "tourn" && own.verified) {
      for (const [column, { target, verified }] of Object.entries(columns)) {
        const parentTourn = references[target]?.tourn;
        if (column === "tourn" || !verified || parentTourn?.target !== "tourn" || !parentTourn.verified) continue;
        terms.push(
          `${row("ownership", table, `${column}.tourn`, target, true)}, COUNT(*) AS count FROM ${q(table)} AS t ` +
            `JOIN ${q(target)} AS p ON p."id" = t.${q(column)} ` +
            `WHERE t."tourn" IS NOT NULL AND p."tourn" IS NOT NULL AND t."tourn" <> p."tourn" HAVING COUNT(*) > 0`,
        );
      }
    }
  }
  for (const [table, [left, right]] of Object.entries(JUNCTIONS)) {
    terms.push(
      `${row("duplicate-membership", table, `${left}, ${right}`, `${table} pairs`, true)}, COUNT(*) AS count FROM (` +
        `SELECT 1 FROM ${q(table)} WHERE ${q(left)} IS NOT NULL AND ${q(right)} IS NOT NULL ` +
        `GROUP BY ${q(left)}, ${q(right)} HAVING COUNT(*) > 1) HAVING COUNT(*) > 0`,
    );
  }
  for (const { table, index, columns } of NULLABLE_UNIQUE_INDEXES) {
    const cols = columns.map(q).join(", ");
    terms.push(
      `${row("nullable-unique", table, columns.join(", "), index, true)}, COUNT(*) AS count FROM (` +
        `SELECT 1 FROM ${q(table)} WHERE ${columns.map((c) => `${q(c)} IS NULL`).join(" OR ")} ` +
        `GROUP BY ${cols} HAVING COUNT(*) > 1) HAVING COUNT(*) > 0`,
    );
  }
  return terms;
}

/**
 * The checks as `SELECT kind, table, columns, target, verified, count`
 * statements, in chunks of `perStatement` (SQLite caps a compound SELECT at
 * 500 terms). Each returns only the checks that found something.
 */
export function auditStatements(perStatement = 100, references = REFERENCES): string[] {
  const terms = auditTerms(references);
  const statements: string[] = [];
  for (let i = 0; i < terms.length; i += perStatement) statements.push(terms.slice(i, i + perStatement).join("\nUNION ALL\n"));
  return statements;
}
