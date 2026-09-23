/**
 * Just enough of upstream's Sequelize `db` object (`api/data/db.js`) to run
 * its raw-SQL controllers and services on D1.
 *
 * Upstream reaches Sequelize almost entirely through
 * `db.sequelize.query(sql, { replacements, type })` with hand-written MySQL,
 * plus a couple of `db.<table>.findOne/findAll({ where })` calls. This shim
 * implements exactly those: named (`:tournId`) and positional (`?`)
 * replacements with array expansion, MySQL → SQLite translation, and plain
 * equality `where` lookups. Model `include`s (eager-loaded associations) are
 * not supported and are ignored.
 */

import type { D1DatabaseLike } from "./d1-types";
import { translateMysqlToSqlite } from "./mysql-compat";
import { normalizeRow, toD1Value } from "./values";

export const QueryTypes = {
  SELECT: "SELECT",
  INSERT: "INSERT",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  RAW: "RAW",
} as const;

type Replacements = Record<string, unknown> | unknown[] | undefined;

export interface QueryOptions {
  replacements?: Replacements;
  type?: string;
  plain?: boolean;
  raw?: boolean;
}

const expand = (value: unknown, params: unknown[]): string => {
  if (Array.isArray(value)) {
    if (value.length === 0) return "NULL";
    for (const v of value) params.push(toD1Value(v));
    return value.map(() => "?").join(", ");
  }
  params.push(toD1Value(value));
  return "?";
};

/**
 * Rewrites Sequelize replacements into D1 `?` binds, leaving string literals,
 * quoted identifiers and `::` casts alone.
 */
export function bindReplacements(sql: string, replacements: Replacements): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  if (!replacements) return { sql, params };
  const positional = Array.isArray(replacements) ? [...replacements] : null;
  let out = "";
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'" || ch === '"' || ch === "`") {
      let j = i + 1;
      while (j < sql.length && sql[j] !== ch) j += sql[j] === "\\" ? 2 : 1;
      out += sql.slice(i, j + 1);
      i = j;
      continue;
    }
    if (positional && ch === "?") {
      out += expand(positional.shift(), params);
      continue;
    }
    if (!positional && ch === ":" && sql[i - 1] !== ":" && sql[i + 1] !== ":") {
      const m = /^[A-Za-z_]\w*/.exec(sql.slice(i + 1));
      if (m && Object.prototype.hasOwnProperty.call(replacements, m[0])) {
        out += expand((replacements as Record<string, unknown>)[m[0]], params);
        i += m[0].length;
        continue;
      }
    }
    out += ch;
  }
  return { sql: out, params };
}

export function createSequelizeShim(getD1: () => D1DatabaseLike) {
  async function query(rawSql: string, options: QueryOptions = {}) {
    const { sql, params } = bindReplacements(rawSql, options.replacements);
    const { results, meta } = await getD1()
      .prepare(translateMysqlToSqlite(sql, { doubleQuotedStrings: true }))
      .bind(...params)
      .all<Record<string, unknown>>();
    const rows = (results ?? []).map((row) => normalizeRow(row, { booleans: false }));
    if (options.plain) return rows[0] ?? null;
    if (options.type === QueryTypes.SELECT) return rows;
    if (options.type === QueryTypes.INSERT) return [meta?.last_row_id, meta?.changes];
    if (options.type === QueryTypes.UPDATE || options.type === QueryTypes.DELETE) return [undefined, meta?.changes];
    return [rows, meta];
  }

  const whereClause = (where: Record<string, unknown> = {}) => {
    const keys = Object.keys(where);
    return {
      sql: keys.length ? ` WHERE ${keys.map((k) => `\`${k}\` ${Array.isArray(where[k]) ? "IN (:" + k + ")" : "= :" + k}`).join(" AND ")}` : "",
      replacements: where,
    };
  };

  /** `db.<table>` — a table's findOne/findAll/findByPk over plain equality filters. */
  const model = (table: string) => ({
    tableName: table,
    name: table,
    associations: {},
    async findAll({ where, limit }: { where?: Record<string, unknown>; limit?: number } = {}) {
      const w = whereClause(where);
      return query(`SELECT * FROM \`${table}\`${w.sql}${limit ? ` LIMIT ${Number(limit)}` : ""}`, {
        replacements: w.replacements,
        type: QueryTypes.SELECT,
      }) as Promise<Record<string, unknown>[]>;
    },
    async findOne(opts: { where?: Record<string, unknown> } = {}) {
      const rows = await this.findAll({ ...opts, limit: 1 });
      return rows[0] ?? null;
    },
    async findByPk(id: unknown) {
      return this.findOne({ where: { id } });
    },
  });

  const base: Record<string, unknown> = {
    sequelize: { query, QueryTypes, authenticate: async () => {} },
    Sequelize: { QueryTypes },
  };

  /** `db.summon(db.<table>, id)` — a row plus its `<table>_setting` rows as `settings`. */
  base.summon = async (dbTable: { tableName: string }, objectId: unknown) => {
    const rows = (await query(`SELECT * FROM \`${dbTable.tableName}\` WHERE id = ? LIMIT 1`, {
      replacements: [objectId],
      type: QueryTypes.SELECT,
    })) as Record<string, unknown>[];
    const row = rows[0];
    if (!row) return undefined;
    const settings: Record<string, unknown> = {};
    try {
      const settingRows = (await query(
        `SELECT tag, value, value_text, value_date FROM \`${dbTable.tableName}_setting\` WHERE \`${dbTable.tableName}\` = ?`,
        { replacements: [objectId], type: QueryTypes.SELECT },
      )) as Record<string, unknown>[];
      for (const s of settingRows) {
        const tag = String(s.tag);
        if (s.value === "date") settings[tag] = s.value_date;
        else if (s.value === "json") settings[tag] = s.value_text ? JSON.parse(String(s.value_text)) : undefined;
        else if (s.value === "text") settings[tag] = s.value_text;
        else settings[tag] = s.value;
      }
    } catch {
      // Table has no settings table.
    }
    return { ...row, table: dbTable.tableName, settings };
  };

  return new Proxy(base, {
    get(target, prop) {
      if (typeof prop !== "string") return undefined;
      if (prop in target) return target[prop];
      if (prop === "then") return undefined;
      return model(prop);
    },
  });
}
