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
 */

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
