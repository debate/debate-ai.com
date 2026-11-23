/**
 * @fileoverview `/api/topic-signups` against a real SQLite database: signing
 * up for a topic and finding the others on it, research squads, research
 * notes, the active-topics list, and the guards.
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";
import { TOPIC_SIGNUPS_DDL, resetEnsuredTopicSignupTables } from "@/lib/topic-signups/ensure-tables";

let db: ReturnType<typeof drizzle<typeof schema>>;
let signedInAs: string | null = "alice";

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({ getUserId: async () => signedInAs }));

const { GET, POST } = await import("@/app/api/topic-signups/route");

const TOPIC = { topic: "Society should go nuclear.", format: "Value", source: "Value resolution Nuke.1" };

async function as(userId: string | null, call: () => Promise<Response>): Promise<{ status: number; body: Record<string, any> }> {
  signedInAs = userId;
  const res = await call();
  return { status: res.status, body: (await res.json()) as Record<string, any> };
}

const board = (userId: string | null, topic = TOPIC.topic) =>
  as(userId, () => GET(new Request(`https://d.ebate.app/api/topic-signups?topic=${encodeURIComponent(topic)}`) as never));
const active = () => as(null, () => GET(new Request("https://d.ebate.app/api/topic-signups") as never));
const post = (userId: string, body: Record<string, unknown>) =>
  as(userId, () =>
    POST(new Request("https://d.ebate.app/api/topic-signups", { method: "POST", body: JSON.stringify({ ...TOPIC, ...body }) }) as never),
  );

describe("/api/topic-signups", () => {
  beforeEach(async () => {
    resetEnsuredTopicSignupTables();
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values(
      ["alice", "bob", "carol", "guest"].map((id) => ({
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        email: `${id}@example.com`,
        isAnonymous: id === "guest",
        createdAt: now,
        updatedAt: now,
      })),
    );
  });

  it("needs an account for a board, but lists active topics publicly", async () => {
    expect((await board(null)).status).toBe(401);
    expect((await active()).body).toEqual({ topics: [] });
  });

  it("signs debaters up and shows each the others", async () => {
    const signed = await post("alice", { action: "signup", role: "debate", side: "aff", note: "Varsity" });
    expect(signed.status).toBe(200);
    expect(signed.body.mine).toMatchObject({ role: "debate", side: "aff", note: "Varsity" });
    expect(signed.body.signups).toEqual([]);

    await post("bob", { action: "signup", role: "research", side: "either", note: "" });
    // Same topic printed differently opens the same board.
    const bobView = await board("bob", "  resolved: society should GO nuclear ");
    expect(bobView.body.signups.map((s: any) => s.person.name)).toEqual(["Alice"]);
    expect(bobView.body.mine.role).toBe("research");

    // Signing up again updates rather than duplicates; withdraw removes it.
    await post("alice", { action: "signup", role: "debate", side: "neg", note: "" });
    expect((await board("bob")).body.signups).toHaveLength(1);
    expect((await board("bob")).body.signups[0].side).toBe("neg");
    await post("alice", { action: "withdraw" });
    expect((await board("bob")).body.signups).toEqual([]);
  });

  it("starts, joins and closes research squads, and tells members who joined", async () => {
    const made = await post("alice", { action: "create-squad", name: "Nuke squad", about: "Waste storage" });
    const squad = made.body.squads[0];
    expect(squad).toMatchObject({ name: "Nuke squad", joined: true, members: [{ name: "Alice" }] });

    const joined = await post("bob", { action: "join-squad", squadId: squad.id });
    expect(joined.body.squads[0].members.map((m: any) => m.name)).toEqual(["Alice", "Bob"]);
    const notes = await db.select().from(schema.notifications);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ userId: "alice", type: "topic_signup" });
    expect(notes[0].link).toContain("/practice/debates?section=topics");

    await post("alice", { action: "leave-squad", squadId: squad.id });
    await post("bob", { action: "leave-squad", squadId: squad.id });
    expect((await board("carol")).body.squads).toEqual([]);
    expect((await post("carol", { action: "join-squad", squadId: squad.id })).status).toBe(404);
  });

  it("adds and deletes research notes, and lists the topic as active", async () => {
    const added = await post("alice", {
      action: "add-note",
      kind: "evidence",
      title: "IPCC on nuclear",
      url: "https://example.com/ipcc",
      body: "Low lifecycle emissions.",
    });
    expect(added.body.notes[0]).toMatchObject({ kind: "evidence", mine: true, url: "https://example.com/ipcc" });
    expect((await post("alice", { action: "add-note", kind: "link", url: "javascript:alert(1)" })).status).toBe(400);

    const carolView = await board("carol");
    expect(carolView.body.notes[0].mine).toBe(false);
    // Only the author can delete.
    await post("carol", { action: "delete-note", noteId: added.body.notes[0].id });
    expect((await board("carol")).body.notes).toHaveLength(1);

    const list = await active();
    expect(list.body.topics[0]).toMatchObject({ topic: { text: TOPIC.topic, format: "Value" }, notes: 1 });

    await post("alice", { action: "delete-note", noteId: added.body.notes[0].id });
    expect((await board("carol")).body.notes).toEqual([]);
  });

  it("refuses guests and bad input", async () => {
    expect((await post("guest", { action: "signup" })).status).toBe(403);
    expect((await post("alice", { action: "nope" })).status).toBe(400);
    expect((await post("alice", { action: "create-squad", name: " " })).status).toBe(400);
    expect((await post("alice", { topic: "", action: "signup" })).status).toBe(400);
  });
});

describe("TOPIC_SIGNUPS_DDL", () => {
  it("creates the same columns as the schema", async () => {
    const fromSchema = await freshSchemaClient();
    const fromDdl = createClient({ url: ":memory:" });
    await fromDdl.execute(`CREATE TABLE "user" ("id" text PRIMARY KEY NOT NULL)`);
    for (const statement of TOPIC_SIGNUPS_DDL) await fromDdl.execute(statement);
    for (const table of ["topic_signups", "topic_squads", "topic_squad_members", "topic_notes"]) {
      const columns = async (client: typeof fromDdl) =>
        (await client.execute(`PRAGMA table_info("${table}")`)).rows.map((row) => [
          row.name,
          String(row.type).toLowerCase(),
          row.notnull,
          row.pk,
        ]);
      expect(await columns(fromDdl)).toEqual(await columns(fromSchema));
    }
  });
});
