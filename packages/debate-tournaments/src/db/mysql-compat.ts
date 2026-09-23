/**
 * MySQL → SQLite translation for the SQL that reaches D1.
 *
 * Upstream Tabroom targets MariaDB. Kysely queries built with its query
 * builder compile to SQLite syntax on their own (this package's dialect uses
 * Kysely's SQLite compiler), but the raw SQL — the `db.sequelize.query()`
 * strings and `sql\`…\`` fragments embedded in Kysely queries — is written in
 * MySQL. Rather than patching every such query in the vendored code (and
 * re-patching it on every upstream pull), the driver runs each statement
 * through {@link translateMysqlToSqlite} first. It rewrites the MySQL-only
 * functions upstream actually uses; anything else passes through untouched,
 * and SQLite already accepts the rest of upstream's dialect (backtick
 * identifiers, `LIMIT a, b`, `IFNULL`, `FROM (a, b)` comma joins, and bare
 * columns under `GROUP BY`).
 *
 * Raw MySQL (`doubleQuotedStrings: true`) also has its `"…"` string literals
 * re-quoted as `'…'`; Kysely-compiled SQL uses `"…"` for identifiers, so the
 * dialect leaves that option off.
 *
 * All timestamps are stored and compared in UTC, so `CONVERT_TZ(x, from, to)`
 * becomes `x` — callers localize for display, as the Svelte client did.
 */

/** Finds the index of the parenthesis that closes the one opened at `open`. */
function matchParen(sql: string, open: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < sql.length; i++) {
    const ch = sql[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")" && --depth === 0) return i;
  }
  return -1;
}

/** Splits a function's argument list on top-level commas. */
function splitArgs(args: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < args.length; i++) {
    const ch = args[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      out.push(args.slice(start, i));
      start = i + 1;
    }
  }
  out.push(args.slice(start));
  return out.map((a) => a.trim());
}

type FunctionRewrite = (args: string[], rawArgs: string) => string;

const INTERVAL_UNITS: Record<string, string> = {
  SECOND: "seconds",
  MINUTE: "minutes",
  HOUR: "hours",
  DAY: "days",
  WEEK: "days",
  MONTH: "months",
  YEAR: "years",
};

/** `INTERVAL 3 DAY` → a SQLite date modifier like `'+3 days'`. */
function intervalModifier(interval: string, sign: "+" | "-"): string | null {
  const m = interval.match(/^INTERVAL\s+(.+?)\s+([A-Z]+)$/i);
  if (!m) return null;
  const unit = INTERVAL_UNITS[m[2].toUpperCase()];
  if (!unit) return null;
  const amount = m[2].toUpperCase() === "WEEK" ? `(${m[1]}) * 7` : m[1];
  return `'${sign}' || (${amount}) || ' ${unit}'`;
}

const REWRITES: Record<string, FunctionRewrite> = {
  NOW: () => "datetime('now')",
  CURRENT_TIMESTAMP: () => "datetime('now')",
  UTC_TIMESTAMP: () => "datetime('now')",
  CURDATE: () => "date('now')",
  RAND: () => "random()",
  // MySQL's CONCAT is NULL if any argument is; so is SQLite's `||` (its own
  // concat() is not, and needs SQLite 3.44).
  CONCAT: (args) => `(${args.map((a) => `(${a})`).join(" || ")})`,
  // WEEK(x, 3) is the ISO-8601 week; other modes fall back to Monday-based weeks.
  WEEK: (args) =>
    args[1]?.trim() === "3"
      ? `((CAST(strftime('%j', date(${args[0]}, '-3 days', 'weekday 4')) AS INTEGER) - 1) / 7 + 1)`
      : `CAST(strftime('%W', ${args[0]}) AS INTEGER)`,
  CONVERT_TZ: (args) => args[0],
  JSON_OBJECTAGG: (_args, raw) => `json_group_object(${raw})`,
  JSON_ARRAYAGG: (_args, raw) => `json_group_array(${raw})`,
  JSON_VALID: (_args, raw) => `json_valid(${raw})`,
  UNIX_TIMESTAMP: (args) => (args[0] ? `CAST(strftime('%s', ${args[0]}) AS INTEGER)` : "CAST(strftime('%s','now') AS INTEGER)"),
  DATE_SUB: (args) => {
    const mod = intervalModifier(args[1] ?? "", "-");
    return mod ? `datetime(${args[0]}, ${mod})` : `DATE_SUB(${args.join(", ")})`;
  },
  DATE_ADD: (args) => {
    const mod = intervalModifier(args[1] ?? "", "+");
    return mod ? `datetime(${args[0]}, ${mod})` : `DATE_ADD(${args.join(", ")})`;
  },
  GROUP_CONCAT: (_args, raw) => {
    // GROUP_CONCAT([DISTINCT] expr [ORDER BY …] [SEPARATOR 'x'])
    const sep = raw.match(/\s+SEPARATOR\s+('(?:[^'\\]|\\.)*')\s*$/i);
    const expr = (sep ? raw.slice(0, sep.index) : raw).trim();
    if (!sep) return `group_concat(${expr})`;
    // SQLite allows DISTINCT only with its default "," separator, so swap the
    // separator in afterwards (values containing "," get it too).
    if (/^DISTINCT\b/i.test(expr)) {
      return sep[1] === "','" ? `group_concat(${expr})` : `replace(group_concat(${expr}), ',', ${sep[1]})`;
    }
    return `group_concat(${expr}, ${sep[1]})`;
  },
  IF: (args) => (args.length === 3 ? `(CASE WHEN ${args[0]} THEN ${args[1]} ELSE ${args[2]} END)` : `IF(${args.join(", ")})`),
  YEAR: (args) => `CAST(strftime('%Y', ${args[0]}) AS INTEGER)`,
  MONTH: (args) => `CAST(strftime('%m', ${args[0]}) AS INTEGER)`,
  DATE: (args) => `date(${args[0]})`,
};

const FUNCTION_RE = new RegExp(`\\b(${Object.keys(REWRITES).join("|")})\\s*\\(`, "iy");

/**
 * Rewrites upstream's MySQL-only SQL for SQLite. Idempotent for already-SQLite
 * SQL, and skips anything inside string literals.
 */
export function translateMysqlToSqlite(sql: string, { doubleQuotedStrings = false } = {}): string {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    // Copy string literals and quoted identifiers through verbatim.
    if (ch === "'" || ch === '"' || ch === "`") {
      let j = i + 1;
      while (j < sql.length && sql[j] !== ch) j += sql[j] === "\\" ? 2 : 1;
      const literal = sql.slice(i, j + 1);
      // In MySQL (without ANSI_QUOTES) "x" is a string; in SQLite it names a column.
      out += doubleQuotedStrings && ch === '"' ? `'${literal.slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "''")}'` : literal;
      i = j + 1;
      continue;
    }
    FUNCTION_RE.lastIndex = i;
    const m = FUNCTION_RE.exec(sql);
    if (m && m.index === i && !/[\w.]/.test(sql[i - 1] ?? "")) {
      const open = i + m[0].length - 1;
      const close = matchParen(sql, open);
      if (close !== -1) {
        const rawArgs = translateMysqlToSqlite(sql.slice(open + 1, close), { doubleQuotedStrings });
        const args = rawArgs.trim() ? splitArgs(rawArgs) : [];
        out += REWRITES[m[1].toUpperCase()](args, rawArgs);
        i = close + 1;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out
    .replace(/\bSTRAIGHT_JOIN\b/gi, "JOIN")
    .replace(/\bSQL_CALC_FOUND_ROWS\b/gi, "")
    .replace(/\bINSERT\s+IGNORE\b/gi, "INSERT OR IGNORE");
}
