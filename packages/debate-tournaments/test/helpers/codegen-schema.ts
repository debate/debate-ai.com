/**
 * A SQLite schema for the Tabroom tables, derived from the kysely-codegen
 * types upstream ships (`vendor/tabroom-build/indexcards/api/data/schema.ts`).
 *
 * The real migration (`migrations/0001_tabroom_schema.sql`) is gitignored, so a
 * fresh checkout (CI) has none. Rather than skip every suite that needs the
 * tables, they run against this stand-in: the same tables and columns, every
 * `id` an auto-increment primary key and every `Generated<…>` column given the
 * default its type implies. It has none of the real migration's indexes, so
 * the suites that check the migration itself still need the real file.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CODEGEN = resolve(import.meta.dirname, "../../vendor/tabroom-build/indexcards/api/data/schema.ts");

/** One column's SQLite declaration from its codegen type, e.g. `Generated<number | null>`. */
export function columnDeclaration(name: string, type: string): string {
  if (name === "id") return `"id" INTEGER PRIMARY KEY AUTOINCREMENT`;
  const generated = /^Generated<(.*)>$/.exec(type);
  const inner = (generated ? generated[1] : type).trim();
  const nullable = /\|\s*null\b/.test(inner);
  const base = inner.replace(/\|\s*null\b/, "").trim();
  const affinity = base === "number" ? "INTEGER" : base === "Decimal" ? "NUMERIC" : "TEXT";
  let fallback = "";
  if (generated && !nullable) {
    if (base === "Date") fallback = " DEFAULT CURRENT_TIMESTAMP";
    else if (base === "number" || base === "Decimal") fallback = " DEFAULT 0";
    else fallback = " DEFAULT ''";
  }
  return `"${name}" ${affinity}${fallback}`;
}

/** `CREATE TABLE` statements for every table in the codegen `DB` interface. */
export function codegenSchemaStatements(source = readFileSync(CODEGEN, "utf8")): string[] {
  const interfaces = new Map<string, Array<[string, string]>>();
  for (const match of source.matchAll(/export interface (\w+) \{([\s\S]*?)\n\}/g)) {
    const columns: Array<[string, string]> = [];
    for (const line of match[2].split("\n")) {
      const column = /^\s*(\w+)\??:\s*(.+);\s*$/.exec(line);
      if (column) columns.push([column[1], column[2]]);
    }
    interfaces.set(match[1], columns);
  }
  const tables = interfaces.get("DB") ?? [];
  return tables.map(([table, typeName]) => {
    const columns = interfaces.get(typeName) ?? [];
    const declarations = columns.map(([name, type]) => columnDeclaration(name, type));
    return `CREATE TABLE IF NOT EXISTS "${table}" (${declarations.join(", ")});`;
  });
}
