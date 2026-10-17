/**
 * @fileoverview `/api/settings/welcome` GET/POST against a real SQLite
 * database: the first-sign-in welcome's dismissal is stored once per
 * account, kept on repeat writes, and isolated per user.
 */

import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;
let signedInAs: string | null = "user-1";

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({ getUserId: async () => signedInAs }));

const { GET, POST } = await import("@/app/api/settings/welcome/route");

const dismissed = async () => (await (await GET()).json()).dismissed;

async function storedAt(userId: string) {
  const [row] = await db
    .select({ at: schema.userSettings.welcomeDismissedAt })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId));
  return row?.at ?? null;
}

describe("/api/settings/welcome", () => {
  beforeEach(async () => {
    signedInAs = "user-1";
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values(
      ["user-1", "user-2"].map((id) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })),
    );
  });

  it("is not dismissed for an account that has never seen it", async () => {
    expect(await dismissed()).toBe(false);
  });

  it("rejects signed-out reads and writes", async () => {
    signedInAs = null;
    expect((await GET()).status).toBe(401);
    expect((await POST()).status).toBe(401);
  });

  it("records the dismissal and keeps the first timestamp", async () => {
    expect((await (await POST()).json()).dismissed).toBe(true);
    expect(await dismissed()).toBe(true);
    const first = await storedAt("user-1");
    expect(first).toBeInstanceOf(Date);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await POST();
    expect((await storedAt("user-1"))?.getTime()).toBe(first?.getTime());
  });

  it("sets the flag on an existing settings row without touching it", async () => {
    await db.insert(schema.userSettings).values({ userId: "user-1", fontSize: 18 });
    await POST();
    const [row] = await db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, "user-1"));
    expect(row.fontSize).toBe(18);
    expect(row.welcomeDismissedAt).toBeInstanceOf(Date);
  });

  it("keeps each account's flag separate", async () => {
    await POST();
    signedInAs = "user-2";
    expect(await dismissed()).toBe(false);
  });
});
