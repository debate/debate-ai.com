/**
 * @fileoverview Exercises the admin user-usage directory's search filter
 * against a real in-memory SQLite database, the same approach
 * `lib/videos/__tests__/admin-library.test.ts` uses: the LIKE-escaping
 * behavior this pins can't be seen through a mocked drizzle handle.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as schema from "../../database/schema";
import { user } from "../../database/schema";
import { loadUserUsagePage } from "../user-usage";

const drizzleDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../drizzle");

const MIGRATIONS = [
  "0000_productive_nomad.sql", // user, session
  "0001_certain_molecule_man.sql", // documents
  "0006_ordinary_wallop.sql", // user.is_anonymous
  "0008_tough_wolfsbane.sql", // saved_flows
  "0011_plain_fantastic_four.sql", // saved_rounds
  "0015_magenta_microbe.sql", // saved_word_count_rounds
  "0016_furry_skrulls.sql", // saved_judge_decisions
  "0018_soft_cerebro.sql", // saved_speech_send_log
  "0028_aspiring_human_fly.sql", // saved_drill_sets
  "0030_practice_vs_ai_debates.sql", // practice_vs_ai_debates
];

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  for (const migration of MIGRATIONS) {
    const contents = readFileSync(path.join(drizzleDir, migration), "utf8");
    for (const statement of contents.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await client.execute(trimmed);
    }
  }
  return drizzle(client, { schema });
}

type UserInsert = typeof user.$inferInsert;

function userRow(id: string, extra: Partial<UserInsert> = {}): UserInsert {
  return {
    id,
    name: `User ${id}`,
    email: `${id}@example.com`,
    createdAt: new Date("2024-09-01"),
    updatedAt: new Date("2024-09-01"),
    ...extra,
  };
}

describe("loadUserUsagePage", () => {
  it("treats a literal % or _ in the search text as itself, not a SQL wildcard", async () => {
    const db = await freshDb();
    await db.insert(user).values([
      userRow("a", { name: "50% Debate Club" }),
      userRow("b", { name: "50 Debate Club" }),
      userRow("c", { name: "Case_Neg Coach" }),
      userRow("d", { name: "CaseXNeg Coach" }),
    ]);

    const byPercent = await loadUserUsagePage(db, { page: 1, limit: 10, search: "50%" });
    expect(byPercent.users.map((r: any) => r.id)).toEqual(["a"]);

    const byUnderscore = await loadUserUsagePage(db, { page: 1, limit: 10, search: "Case_Neg" });
    expect(byUnderscore.users.map((r: any) => r.id)).toEqual(["c"]);
  });

  it("searches by name or email", async () => {
    const db = await freshDb();
    await db.insert(user).values([
      userRow("a", { name: "Harvard Squad" }),
      userRow("b", { name: "Someone Else", email: "harvard-coach@example.com" }),
      userRow("c", { name: "Berkeley Squad" }),
    ]);

    const byName = await loadUserUsagePage(db, { page: 1, limit: 10, search: "harvard" });
    expect(byName.users.map((r: any) => r.id).sort()).toEqual(["a", "b"]);
  });
});
