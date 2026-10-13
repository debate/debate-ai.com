/**
 * Writes the migration that moves an existing D1 database from one generated
 * Tabroom schema to the next.
 *
 * `migrations/0001_tabroom_schema.sql` is regenerated in place, but the deploy
 * runner (`.github/scripts/migrate-d1.ts`) applies each file once, so a
 * database that already ran 0001 never sees a change to it. When a sync
 * changes 0001, `sync-upstream.mjs` therefore also writes the next-numbered
 * `NNNN_tabroom_schema_upgrade.sql`, computed here by loading both versions
 * into SQLite and comparing them:
 *
 *  - a table whose definition changed is rebuilt (create, copy, drop, rename —
 *    SQLite cannot alter a column's type or constraints in place), mapping a
 *    reference column's 0 sentinel to NULL and coercing flag columns to 0/1 on
 *    the way, then its indexes are recreated;
 *  - an index that no longer exists is dropped, a new one created;
 *  - a new table is created. A table the new schema no longer has is left
 *    alone: dropping data is never automatic.
 *
 * Every statement also runs cleanly on a database that already has the new
 * schema (a fresh one that ran the new 0001), leaving it unchanged.
 */

import { DatabaseSync } from "node:sqlite";

const q = (id) => `"${id.replace(/"/g, '""')}"`;

/** Loads generated DDL and returns its tables and indexes by name. */
function inspect(sql) {
  const db = new DatabaseSync(":memory:");
  db.exec(sql.replace(/--> statement-breakpoint/g, ""));
  const objects = db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL").all();
  const tables = new Map();
  const indexes = new Map();
  for (const o of objects) {
    if (o.type === "table" && o.name !== "sqlite_sequence") {
      const columns = db.prepare(`SELECT name FROM pragma_table_info(?)`).all(o.name).map((c) => c.name);
      tables.set(o.name, { sql: o.sql, columns });
    } else if (o.type === "index") {
      indexes.set(o.name, { sql: o.sql, table: o.tbl_name });
    }
  }
  db.close();
  return { tables, indexes };
}

const ifNotExists = (sql) => sql.replace(/^CREATE (TABLE|(?:UNIQUE )?INDEX) (?!IF NOT EXISTS)/, "CREATE $1 IF NOT EXISTS ");

/** The value copied into a rebuilt column. */
function copyExpression(col) {
  const name = q(col.name);
  if (col.sentinel) return `NULLIF(${name}, 0)`;
  if (col.check === "IN (0, 1)") return `CASE WHEN ${name} IS NULL THEN NULL WHEN ${name} = 0 THEN 0 ELSE 1 END`;
  return name;
}

/**
 * Statements upgrading a database built from `oldSql` to `newSql`.
 * @param {string} oldSql the previously generated 0001 migration
 * @param {string} newSql the newly generated one
 * @param {ReturnType<import("./mysql-to-sqlite.mjs").applySchemaRules>} tables the rules-applied tables `newSql` came from
 */
export function upgradeStatements(oldSql, newSql, tables) {
  const before = inspect(oldSql);
  const after = inspect(newSql);
  const columnsOf = new Map(tables.map((t) => [t.name, new Map(t.columns.map((c) => [c.name, c]))]));
  const statements = [];
  const rebuilt = new Set();

  for (const [name, index] of before.indexes) {
    if (!after.indexes.has(name)) statements.push(`DROP INDEX IF EXISTS ${q(name)};`);
    else if (after.indexes.get(name).sql !== index.sql) statements.push(`DROP INDEX IF EXISTS ${q(name)};`);
  }

  for (const [name, table] of after.tables) {
    const old = before.tables.get(name);
    if (!old) {
      statements.push(`${ifNotExists(table.sql)};`);
      continue;
    }
    if (old.sql === table.sql) continue;
    rebuilt.add(name);
    const temp = `${name}__upgrade`;
    const shared = table.columns.filter((c) => old.columns.includes(c));
    const cols = columnsOf.get(name) ?? new Map();
    const exprs = shared.map((c) => (cols.has(c) ? copyExpression(cols.get(c)) : q(c)));
    statements.push(
      `DROP TABLE IF EXISTS ${q(temp)};`,
      `${table.sql.replace(/^CREATE TABLE (?:IF NOT EXISTS )?"[^"]+"/, `CREATE TABLE ${q(temp)}`)};`,
      `INSERT INTO ${q(temp)} (${shared.map(q).join(", ")}) SELECT ${exprs.join(", ")} FROM ${q(name)};`,
      `DROP TABLE ${q(name)};`,
      `ALTER TABLE ${q(temp)} RENAME TO ${q(name)};`,
    );
  }

  for (const [name, index] of after.indexes) {
    const old = before.indexes.get(name);
    if (rebuilt.has(index.table) || !old || old.sql !== index.sql) statements.push(`${ifNotExists(index.sql)};`);
  }
  return statements;
}
