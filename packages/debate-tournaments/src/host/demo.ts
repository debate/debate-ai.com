/// <reference path="../raw.d.ts" />
/**
 * Loads `seed/demo.sql` into the tournaments database on demand, so the demo
 * tournament is there on every deployment without anyone running the seed
 * script: `POST {apiBase}/host/demo` calls {@link ensureDemoTournament}, which
 * re-applies the seed only when the demo is missing or has ended (its dates
 * are relative to load time). Every demo row has an id ≥ 90000 and is written
 * with `INSERT OR REPLACE`, so this never touches hosted or real data.
 */

import demoSql from "../../seed/demo.sql?raw";
import type { D1DatabaseLike } from "../db/d1-types";
import { getTabroomD1, getTabroomKysely } from "../db/runtime";
import { DEMO_ADMIN, DEMO_TOURN_ID } from "./demo-account";

/** The seed's statements, comments dropped. Statements end with `;` at the end of a line. */
export function splitSqlStatements(sql: string): string[] {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

/** Whether the demo tournament and its mock admin are loaded and not yet over. */
export async function demoIsFresh(now = new Date()): Promise<boolean> {
  const db = getTabroomKysely();
  const [tourn, admin] = await Promise.all([
    // Stored DATETIMEs are UTC `YYYY-MM-DD HH:MM:SS`, and a bound Date becomes
    // the same, so the comparison is a plain string one.
    db.selectFrom("tourn").select(["id"]).where("id", "=", DEMO_TOURN_ID).where("end", ">", now).executeTakeFirst(),
    db.selectFrom("permission").select(["id"]).where("person", "=", DEMO_ADMIN.personId).where("tourn", "=", DEMO_TOURN_ID).executeTakeFirst(),
  ]);
  return Boolean(tourn && admin);
}

/** Applies the demo seed. Must run inside a database scope. */
export async function seedDemo(d1: D1DatabaseLike = getTabroomD1()): Promise<void> {
  const statements = splitSqlStatements(demoSql);
  if (d1.batch) {
    await d1.batch(statements.map((statement) => d1.prepare(statement)));
    return;
  }
  for (const statement of statements) await d1.prepare(statement).all();
}

/** Loads the demo when it is missing or stale; answers whether it had to. */
export async function ensureDemoTournament(): Promise<{ seeded: boolean }> {
  if (await demoIsFresh()) return { seeded: false };
  await seedDemo();
  return { seeded: true };
}
