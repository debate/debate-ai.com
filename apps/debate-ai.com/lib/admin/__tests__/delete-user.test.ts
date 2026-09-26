/**
 * @fileoverview Exercises admin account deletion — the helper and the
 * `DELETE /api/admin/users/[id]` route — against a real in-memory SQLite
 * database built from the current drizzle schema, so every user-linked table
 * the helper discovers actually exists and carries its real constraints.
 */
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from "drizzle-kit/api";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../database/schema";
import { cardAiAnalyses, contacts, savedFlows, session, user } from "../../database/schema";
import { deleteUserAccount } from "../delete-user";

const access = vi.hoisted(() => ({ email: null as string | null, db: null as unknown }));

vi.mock("@/lib/auth/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/admin")>();
  return {
    ...actual,
    getAdminAccess: async () => ({
      isAdmin: actual.isAdminEmail(access.email),
      email: access.email,
    }),
  };
});

vi.mock("@/lib/database/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/database/context")>()),
  getDBFromContext: async () => access.db,
}));

const { DELETE } = await import("@/app/api/admin/users/[id]/route");

let ddl: string[] | undefined;

/**
 * A fresh database with the full schema. `foreignKeys` off (SQLite's default)
 * stands in for a production table created without its constraint, which is
 * the case the helper's explicit cleanup exists for; on is what D1 enforces.
 */
async function freshDb({ foreignKeys = false, skipTables = [] as string[] } = {}) {
  ddl ??= await generateSQLiteMigration(
    await generateSQLiteDrizzleJson({}),
    await generateSQLiteDrizzleJson(schema),
  );
  const client = createClient({ url: ":memory:" });
  for (const statement of ddl) {
    const table = statement.match(/^CREATE TABLE `([^`]+)`/)?.[1];
    const indexOn = statement.match(/^CREATE (?:UNIQUE )?INDEX .* ON `([^`]+)`/)?.[1];
    if (skipTables.includes(table ?? indexOn ?? "")) continue;
    await client.execute(statement);
  }
  await client.execute(`PRAGMA foreign_keys = ${foreignKeys ? "ON" : "OFF"}`);
  return drizzle(client, { schema });
}

type DB = Awaited<ReturnType<typeof freshDb>>;

const now = new Date("2026-09-01");

async function seedUser(db: DB, id: string, email = `${id}@example.com`) {
  await db.insert(user).values({ id, name: `User ${id}`, email, createdAt: now, updatedAt: now });
  await db.insert(session).values({
    id: `session-${id}`,
    token: `token-${id}`,
    userId: id,
    expiresAt: now,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(savedFlows).values({ userId: id, clientId: 1, data: "{}" });
}

describe("deleteUserAccount", () => {
  for (const foreignKeys of [false, true]) {
    it(`removes the account and everything it owns (foreign keys ${foreignKeys ? "on" : "off"})`, async () => {
      const db = await freshDb({ foreignKeys });
      await seedUser(db, "doomed");
      await seedUser(db, "keeper");
      await db.insert(contacts).values([
        { requesterId: "doomed", addresseeId: "keeper" },
        { requesterId: "keeper", addresseeId: "doomed" },
      ]);
      await db.insert(cardAiAnalyses).values({
        cardHash: "c",
        promptHash: "p",
        result: "{}",
        userId: "doomed",
      });

      const deleted = await deleteUserAccount(db, "doomed");
      expect(deleted).toEqual({ id: "doomed", name: "User doomed", email: "doomed@example.com" });

      expect((await db.select().from(user)).map((row) => row.id)).toEqual(["keeper"]);
      expect((await db.select().from(session)).map((row) => row.userId)).toEqual(["keeper"]);
      expect((await db.select().from(savedFlows)).map((row) => row.userId)).toEqual(["keeper"]);
      // A contact row involving the user on *either* side goes with them.
      expect(await db.select().from(contacts)).toEqual([]);
      // `set null` references keep the shared row and just drop the owner.
      const [analysis] = await db.select().from(cardAiAnalyses);
      expect(analysis.userId).toBeNull();
    });
  }

  it("returns null and changes nothing for an unknown id", async () => {
    const db = await freshDb();
    await seedUser(db, "keeper");
    expect(await deleteUserAccount(db, "missing")).toBeNull();
    expect(await db.select().from(user)).toHaveLength(1);
  });

  it("skips user-linked tables the database doesn't have yet", async () => {
    const db = await freshDb({ skipTables: ["saved_learn_cards", "notifications"] });
    await seedUser(db, "doomed");
    expect(await deleteUserAccount(db, "doomed")).not.toBeNull();
    expect(await db.select().from(user)).toEqual([]);
  });
});

describe("DELETE /api/admin/users/[id]", () => {
  const request = (id: string) =>
    DELETE(new NextRequest(`http://localhost/api/admin/users/${id}`, { method: "DELETE" }), {
      params: Promise.resolve({ id }),
    });

  beforeEach(() => {
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
    access.email = "admin@example.com";
  });
  afterEach(() => vi.unstubAllEnvs());

  it("deletes the user for an admin", async () => {
    const db = await freshDb({ foreignKeys: true });
    access.db = db;
    await seedUser(db, "doomed");

    const res = await request("doomed");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, user: { id: "doomed" } });
    expect(await db.select().from(user).where(eq(user.id, "doomed"))).toEqual([]);
  });

  it("forbids non-admins", async () => {
    const db = await freshDb();
    access.db = db;
    access.email = "someone@example.com";
    await seedUser(db, "doomed");

    expect((await request("doomed")).status).toBe(403);
    expect(await db.select().from(user)).toHaveLength(1);
  });

  it("refuses to delete an admin account", async () => {
    const db = await freshDb();
    access.db = db;
    await seedUser(db, "boss", "Admin@Example.com");

    const res = await request("boss");
    expect(res.status).toBe(400);
    expect(await db.select().from(user)).toHaveLength(1);
  });

  it("404s for an unknown id", async () => {
    access.db = await freshDb();
    expect((await request("missing")).status).toBe(404);
  });
});
