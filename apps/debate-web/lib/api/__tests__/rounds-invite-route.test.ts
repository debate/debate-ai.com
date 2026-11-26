/**
 * @fileoverview `/api/rounds/invite` against a real SQLite database, with no
 * email provider configured: registered accounts get an in-app notification,
 * everyone else is skipped, and the inviter is never invited.
 */

import { NextRequest } from "next/server";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;
let session: { user: { id: string; name: string; email: string } } | null;

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => session }));
vi.mock("@/lib/env", () => ({ getEnv: () => undefined }));

const route = await import("@/app/api/rounds/invite/route");

const invite = (body: unknown) =>
  route.POST(new NextRequest("https://debate-ai.com/api/rounds/invite", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

describe("/api/rounds/invite", () => {
  beforeEach(async () => {
    session = { user: { id: "alex", name: "Alex", email: "Alex@Example.com" } };
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values(
      [["alex", "alex@example.com"], ["sam", "sam@example.com"]].map(([id, email]) => ({ id, name: id, email, createdAt: now, updatedAt: now })),
    );
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("requires a session, a JSON body, an emails array and a tournament name", async () => {
    session = null;
    expect((await invite({})).status).toBe(401);
    session = { user: { id: "alex", name: "Alex", email: "alex@example.com" } };
    expect((await invite("{nope")).status).toBe(400);
    expect((await invite({ emails: "sam@example.com", tournamentName: "T" })).status).toBe(400);
    expect((await invite({ emails: [], tournamentName: "  " })).status).toBe(400);
  });

  it("does nothing when no valid recipient remains after dropping bad addresses and the inviter", async () => {
    const res = await invite({ emails: ["not-an-email", 5, "alex@example.com", "ALEX@example.com"], tournamentName: "Nationals" });
    expect(await res.json()).toEqual({ notified: [], emailed: [], skipped: [] });
    expect(await db.select().from(schema.notifications)).toEqual([]);
  });

  it("notifies registered accounts once and skips unregistered ones without a mail provider", async () => {
    const res = await invite({
      emails: ["Sam@example.com", "sam@example.com", "stranger@example.com"],
      tournamentName: "Nationals",
      roundLevel: "Finals",
      slug: " abc123 ",
    });
    expect(await res.json()).toEqual({ notified: ["sam@example.com"], emailed: [], skipped: ["stranger@example.com"] });

    const rows = await db.select().from(schema.notifications);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: "sam",
      type: "round_invite",
      title: "Alex invited you to a debate round",
      body: "Nationals — Finals",
      link: "/debate/abc123",
    });
  });

  it("labels the round with just the tournament and links nowhere when there is no level or slug", async () => {
    await invite({ emails: ["sam@example.com"], tournamentName: "Nationals", roundLevel: "  ", slug: "" });
    const [row] = await db.select().from(schema.notifications);
    expect(row).toMatchObject({ body: "Nationals", link: null });
  });
});
