/**
 * Converts upstream Tabroom's MariaDB dump (`indexcards/tests/test.sql`) into
 * SQLite DDL that Cloudflare D1 accepts, plus (optionally) its sample rows.
 *
 * Upstream keeps its schema only as a mysqldump, so this is what lets a fresh
 * upstream pull regenerate the D1 migration instead of hand-porting every
 * table change. The rules:
 *
 *  - every table becomes `CREATE TABLE IF NOT EXISTS`, integer types collapse
 *    to INTEGER, character/date types to TEXT, float/double to REAL and
 *    decimal to NUMERIC (SQLite type affinity);
 *  - a single-column `AUTO_INCREMENT` primary key becomes
 *    `INTEGER PRIMARY KEY AUTOINCREMENT`;
 *  - `KEY`/`UNIQUE KEY` become separate `CREATE [UNIQUE] INDEX IF NOT EXISTS`
 *    statements (index names are prefixed with the table, since SQLite index
 *    names are database-wide), with MySQL prefix lengths `col(191)` dropped;
 *  - foreign keys, FULLTEXT keys, `ON UPDATE current_timestamp()`, charsets,
 *    collations and comments are dropped — D1 enforces foreign keys, and
 *    Tabroom's data was never written under them;
 *  - tables listed in `skipTables` are left out (e.g. `session`, which would
 *    collide with better-auth's table in the host app's database).
 *
 * `applySchemaRules` then corrects what upstream's types get wrong (see
 * `schema-rules.mjs`): it drops indexes another index already covers, widens
 * types that lose data, adds CHECK constraints to flag columns, and turns a
 * reference column's `DEFAULT 0` "none" sentinel into a nullable column.
 */

import {
  CHECKS,
  EXTRA_INDEXES,
  MONEY_COLUMNS,
  NOT_BOOLEAN,
  NOT_REFERENCES,
  REFERENCE_COLUMNS,
  SEED_NULL_COLUMNS,
  TYPE_OVERRIDES,
} from "./schema-rules.mjs";

const INTEGER_TYPES = new Set(["tinyint", "smallint", "mediumint", "int", "integer", "bigint", "bit", "year"]);
const REAL_TYPES = new Set(["float", "double", "real"]);
const NUMERIC_TYPES = new Set(["decimal", "numeric"]);
const BLOB_TYPES = new Set(["blob", "tinyblob", "mediumblob", "longblob", "binary", "varbinary"]);

/** Splits a column list like "`a`,`b`(191)" into bare column names. */
function parseColumnList(list) {
  return list
    .split(",")
    .map((c) => c.trim().replace(/\(\d+\)$/, "").replace(/`/g, ""))
    .filter(Boolean);
}

function sqliteType(mysqlType) {
  const base = mysqlType.toLowerCase();
  if (INTEGER_TYPES.has(base)) return "INTEGER";
  if (REAL_TYPES.has(base)) return "REAL";
  if (NUMERIC_TYPES.has(base)) return "NUMERIC";
  if (BLOB_TYPES.has(base)) return "BLOB";
  return "TEXT";
}

/** Converts a MySQL DEFAULT clause's value to SQLite, or null to drop it. */
function sqliteDefault(value) {
  if (/^current_timestamp(\(\))?$/i.test(value)) return "CURRENT_TIMESTAMP";
  if (/^NULL$/i.test(value)) return "NULL";
  if (/^-?\d+(\.\d+)?$/.test(value)) return value;
  if (/^'.*'$/s.test(value)) return mysqlStringToSqlite(value);
  if (/^b'[01]+'$/i.test(value)) return String(parseInt(value.slice(2, -1), 2));
  return null;
}

/** Re-quotes a MySQL single-quoted literal (backslash escapes) as a SQLite one. */
export function mysqlStringToSqlite(literal) {
  const inner = literal.slice(1, -1);
  let out = "";
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "\\" && i + 1 < inner.length) {
      const next = inner[++i];
      out += { n: "\n", r: "\r", t: "\t", 0: "\0", Z: "\x1a", b: "\b" }[next] ?? next;
    } else if (ch === "'" && inner[i + 1] === "'") {
      out += "'";
      i++;
    } else {
      out += ch;
    }
  }
  return `'${out.replace(/'/g, "''")}'`;
}

/**
 * Parses every `CREATE TABLE` in a mysqldump.
 * @returns {Array<{ name: string, columns: Array<{ name: string, type: string, mysqlType: string, length: string|null, notNull: boolean, default: string|null, autoIncrement: boolean }>, primaryKey: string[], indexes: Array<{ name: string, unique: boolean, columns: string[] }> }>}
 */
export function parseMysqlTables(dump) {
  const tables = [];
  const createRe = /CREATE TABLE `([^`]+)` \(\n([\s\S]*?)\n\)[^;]*;/g;
  for (const match of dump.matchAll(createRe)) {
    const [, name, body] = match;
    const table = { name, columns: [], primaryKey: [], indexes: [] };
    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim().replace(/,$/, "");
      let m;
      if ((m = line.match(/^PRIMARY KEY \((.+)\)/))) {
        table.primaryKey = parseColumnList(m[1]);
      } else if ((m = line.match(/^(UNIQUE )?KEY `([^`]+)` \((.+?)\)(?: USING \w+)?$/))) {
        table.indexes.push({ name: m[2], unique: Boolean(m[1]), columns: parseColumnList(m[3]) });
      } else if ((m = line.match(/^`([^`]+)` (\w+)(?:\(([^)]*)\))?(.*)$/))) {
        const [, colName, mysqlType, length, rest] = m;
        const defaultMatch = rest.match(/DEFAULT ('(?:[^'\\]|\\.|'')*'|b'[01]+'|[^\s,]+)/i);
        table.columns.push({
          name: colName,
          mysqlType: mysqlType.toLowerCase(),
          length: length ?? null,
          type: sqliteType(mysqlType),
          notNull: /NOT NULL/i.test(rest),
          default: defaultMatch ? sqliteDefault(defaultMatch[1]) : null,
          autoIncrement: /AUTO_INCREMENT/i.test(rest),
        });
      }
      // CONSTRAINT … FOREIGN KEY, FULLTEXT KEY and anything else: dropped.
    }
    tables.push(table);
  }
  return tables;
}

const q = (id) => `"${id.replace(/"/g, '""')}"`;

/**
 * SQLite DDL for the parsed tables.
 * @param {ReturnType<typeof parseMysqlTables>} tables
 * @param {{ skipTables?: string[] }} [options]
 */
export function tablesToSqlite(tables, { skipTables = [] } = {}) {
  const skip = new Set(skipTables);
  const statements = [];
  for (const table of tables) {
    if (skip.has(table.name)) continue;
    const singleAutoPk =
      table.primaryKey.length === 1 &&
      table.columns.find((c) => c.name === table.primaryKey[0] && c.autoIncrement && c.type === "INTEGER");
    const defs = table.columns.map((col) => {
      if (singleAutoPk && col.name === singleAutoPk.name) {
        return `  ${q(col.name)} INTEGER PRIMARY KEY AUTOINCREMENT`;
      }
      let def = `  ${q(col.name)} ${col.type}`;
      if (col.notNull) def += " NOT NULL";
      if (col.default !== null && !(col.default === "NULL" && col.notNull)) def += ` DEFAULT ${col.default}`;
      if (col.check) def += ` CHECK (${q(col.name)} ${col.check})`;
      return def;
    });
    if (table.primaryKey.length && !singleAutoPk) {
      defs.push(`  PRIMARY KEY (${table.primaryKey.map(q).join(", ")})`);
    }
    statements.push(`CREATE TABLE IF NOT EXISTS ${q(table.name)} (\n${defs.join(",\n")}\n);`);
    for (const index of table.indexes) {
      const indexName = `${table.name}__${index.name}`;
      statements.push(
        `CREATE ${index.unique ? "UNIQUE " : ""}INDEX IF NOT EXISTS ${q(indexName)} ON ${q(table.name)} (${index.columns
          .map(q)
          .join(", ")});`,
      );
    }
  }
  return statements;
}

/** True for a MySQL boolean (`tinyint(1)`) column. */
const isTinyintBool = (col) => col.mysqlType === "tinyint" && col.length === "1";

/**
 * The table a column's values are ids of, or null. A reference is an INTEGER
 * column (never a `tinyint(1)` flag) named after a table, or listed in
 * `REFERENCE_COLUMNS`, unless `NOT_REFERENCES` says otherwise.
 * @param {string} table
 * @param {{ name: string, type: string, mysqlType: string, length: string|null }} col
 * @param {Set<string>} tableNames
 */
export function referenceTarget(table, col, tableNames) {
  if (col.type !== "INTEGER" || isTinyintBool(col)) return null;
  if (NOT_REFERENCES.has(`${table}.${col.name}`)) return null;
  if (REFERENCE_COLUMNS[col.name]) return REFERENCE_COLUMNS[col.name];
  return tableNames.has(col.name) ? col.name : null;
}

/**
 * Index names on `table` that another index (or the primary key) already
 * covers: same columns, or a leading prefix of a longer index. A unique index
 * is only dropped for another unique index (or the primary key) over the same
 * columns, in any order; of two equal indexes the unique one, then the one
 * named after its columns, then the first declared, is kept.
 */
export function redundantIndexes(table) {
  const pk = table.primaryKey.length ? [{ name: "PRIMARY", unique: true, columns: table.primaryKey, pk: true }] : [];
  const all = [...pk, ...table.indexes];
  const rank = (ix) => [ix.pk ? 0 : 1, ix.unique ? 0 : 1, ix.name === ix.columns.join("_") ? 0 : 1, all.indexOf(ix)];
  const better = (a, b) => {
    const [ra, rb] = [rank(a), rank(b)];
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] < rb[i];
    return false;
  };
  const isPrefix = (a, b) => a.length <= b.length && a.every((c, i) => b[i] === c);
  const sameSet = (a, b) => a.length === b.length && a.every((c) => b.includes(c));
  const dropped = new Set();
  for (const ix of table.indexes) {
    for (const other of all) {
      if (other === ix || dropped.has(other.name)) continue;
      const same = isPrefix(ix.columns, other.columns) && ix.columns.length === other.columns.length;
      const covered = ix.unique
        ? other.unique && sameSet(ix.columns, other.columns) && better(other, ix)
        : (same && better(other, ix)) || (isPrefix(ix.columns, other.columns) && !same);
      if (covered) {
        dropped.add(ix.name);
        break;
      }
    }
  }
  return dropped;
}

/**
 * Applies `schema-rules.mjs` to parsed tables. Returns new table objects whose
 * columns carry `check`, `reference` and `sentinel` (a reference whose
 * `DEFAULT 0` became nullable), and a `droppedIndexes` list per table.
 * @param {ReturnType<typeof parseMysqlTables>} tables
 */
export function applySchemaRules(tables) {
  const tableNames = new Set(tables.map((t) => t.name));
  return tables.map((table) => {
    const columns = table.columns.map((source) => {
      const key = `${table.name}.${source.name}`;
      const col = { ...source, check: null, reference: referenceTarget(table.name, source, tableNames), sentinel: false };
      if (TYPE_OVERRIDES[key]) col.type = TYPE_OVERRIDES[key];
      if (MONEY_COLUMNS.has(key)) col.type = "NUMERIC";
      if (CHECKS[key]) col.check = CHECKS[key];
      else if (isTinyintBool(source) && !NOT_BOOLEAN.has(key)) col.check = "IN (0, 1)";
      if (col.reference && col.default === "0" && !table.primaryKey.includes(col.name)) {
        col.sentinel = true;
        col.notNull = false;
        col.default = "NULL";
      }
      return col;
    });
    const droppedIndexes = redundantIndexes(table);
    const indexes = table.indexes.filter((ix) => !droppedIndexes.has(ix.name));
    for (const cols of EXTRA_INDEXES[table.name] ?? []) {
      if (indexes.some((ix) => ix.columns.join() === cols.join())) continue;
      indexes.push({ name: cols.join("_"), unique: false, columns: cols });
    }
    return { ...table, columns, indexes, droppedIndexes: [...droppedIndexes] };
  });
}

/**
 * Statements that bring sample rows in line with `applySchemaRules`: a
 * reference column's 0 "none" becomes NULL, and password columns are blanked.
 * @param {ReturnType<typeof applySchemaRules>} tables
 * @param {{ skipTables?: string[] }} [options]
 */
export function seedCleanupStatements(tables, { skipTables = [] } = {}) {
  const skip = new Set(skipTables);
  const statements = [];
  for (const table of tables) {
    if (skip.has(table.name)) continue;
    for (const col of table.columns) {
      if (col.sentinel) statements.push(`UPDATE ${q(table.name)} SET ${q(col.name)} = NULL WHERE ${q(col.name)} = 0;`);
    }
  }
  const present = new Set(tables.map((t) => t.name));
  for (const key of SEED_NULL_COLUMNS) {
    const [table, column] = key.split(".");
    if (present.has(table) && !skip.has(table)) statements.push(`UPDATE ${q(table)} SET ${q(column)} = NULL WHERE ${q(column)} IS NOT NULL;`);
  }
  return statements;
}

/**
 * Column names that are `tinyint(1)` (MySQL booleans) in every table that has
 * them — the ones the D1 driver can safely turn from 0/1 back into booleans,
 * as upstream's MariaDB `typeCast` did.
 */
export function booleanColumns(tables) {
  const verdict = new Map();
  for (const table of tables) {
    for (const col of table.columns) {
      const isBool = col.mysqlType === "tinyint" && col.length === "1";
      verdict.set(col.name, (verdict.get(col.name) ?? true) && isBool);
    }
  }
  return [...verdict].filter(([, isBool]) => isBool).map(([name]) => name).sort();
}

/** Column names holding DATETIME/TIMESTAMP/DATE values in any table. */
export function dateColumns(tables) {
  const names = new Set();
  for (const table of tables) {
    for (const col of table.columns) {
      if (["datetime", "timestamp", "date"].includes(col.mysqlType)) names.add(col.name);
    }
  }
  return [...names].sort();
}

/**
 * Yields the dump's `INSERT INTO` statements rewritten for SQLite (string
 * escapes re-quoted), skipping `skipTables`. Used for the optional local
 * sample-data seed; never for production.
 * @param {string} dump
 * @param {{ skipTables?: string[] }} [options]
 */
export function* mysqlInsertsToSqlite(dump, { skipTables = [] } = {}) {
  const skip = new Set(skipTables);
  const insertRe = /^INSERT INTO `([^`]+)` VALUES\n?([\s\S]*?);\n/gm;
  for (const match of dump.matchAll(insertRe)) {
    const [, table, values] = match;
    if (skip.has(table)) continue;
    const converted = values.replace(/'(?:[^'\\]|\\.|'')*'/g, (lit) => mysqlStringToSqlite(lit));
    yield `INSERT OR IGNORE INTO ${q(table)} VALUES\n${converted};`;
  }
}
