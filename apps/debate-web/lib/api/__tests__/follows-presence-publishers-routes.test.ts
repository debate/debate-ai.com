/**
 * @fileoverview `/api/follows`, `/api/flow-presence` and `/api/market/publishers`
 * against a real SQLite database: following is per account and bounded, flow
 * presence keeps one heartbeat per collaborator per flow, and only a full
 * (non-guest) account may create a research publisher.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { freshSchemaDb } from "@/lib/database/__tests__/schema-sql";
import * as schema from "@/lib/database/schema";
import { MAX_FOLLOWS_PER_USER } from "@/lib/profile-follows/queries";

type Db = Awaited<ReturnType<typeof freshSchemaDb>>;

let db: Db;
let signedInAs: string | null = null;

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db, getCloudflareContext: () => undefined }));
vi.mock("@/lib/auth/session", () => ({ getUserId: async () => signedInAs }));

const follows = await import("@/app/api/follows/route");
const presence = await import("@/app/api/flow-presence/route");
const publishers = await import("@/app/api/market/publishers/route");

const req = (url: string, method = "GET", body?: unknown) =>
  new NextRequest(`https://debate-ai.com${url}`, {
    method,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
const call = (handler: unknown, request: NextRequest) => (handler as (r: NextRequest, c?: unknown) => Promise<Response>)(request, undefined);

async function addUser(id: string, isAnonymous = false) {
  const now = new Date();
  await db.insert(schema.user).values({ id, name: id, email: `${id}@example.com`, isAnonymous, createdAt: now, updatedAt: now });
}

beforeEach(async () => {
  db = await freshSchemaDb();
  signedInAs = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
  await addUser("alex");
  await addUser("sam");
});

describe("/api/follows", () => {
  const put = (body: unknown) => call(follows.PUT, req("/api/follows", "PUT", body));
  const state = (query: string) => call(follows.GET, req(`/api/follows${query}`));

  it("needs a session to follow, and a valid body", async () => {
    expect((await put({ kind: "team", slug: "harker-ab", name: "Harker AB", follow: true })).status).toBe(401);
    signedInAs = "alex";
    expect((await put("{nope")).status).toBe(400);
    expect((await put({ kind: "robot", slug: "x", name: "X", follow: true })).status).toBe(400);
    expect((await put({ kind: "team", slug: "Bad Slug", name: "X", follow: true })).status).toBe(400);
    const noName = await put({ kind: "team", slug: "harker-ab", follow: true });
    expect((await noName.json()).error).toBe("name is required to follow.");
  });

  it("counts followers per profile, and tells a signed-in reader whether they follow", async () => {
    signedInAs = "alex";
    expect(await (await put({ kind: "team", slug: "harker-ab", name: "Harker AB", follow: true })).json()).toEqual({
      kind: "team", slug: "harker-ab", followers: 1, following: true, signedIn: true,
    });
    signedInAs = "sam";
    await put({ kind: "team", slug: "harker-ab", name: "Harker AB", follow: true });

    signedInAs = null;
    expect(await (await state("?kind=team&slug=harker-ab")).json()).toMatchObject({ followers: 2, following: false, signedIn: false });
    signedInAs = "alex";
    expect(await (await state("?kind=team&slug=harker-ab")).json()).toMatchObject({ followers: 2, following: true });
    expect(await (await state("?kind=school&slug=harker-ab")).json()).toMatchObject({ followers: 0, following: false });
  });

  it("unfollows only the caller's follow", async () => {
    signedInAs = "alex";
    await put({ kind: "publisher", slug: "camp-x", name: "Camp X", follow: true });
    signedInAs = "sam";
    await put({ kind: "publisher", slug: "camp-x", name: "Camp X", follow: true });
    const after = await put({ kind: "publisher", slug: "camp-x", follow: false });
    expect(await after.json()).toMatchObject({ followers: 1, following: false });
  });

  it("lists the signed-in user's follows, and an empty list when signed out", async () => {
    signedInAs = "alex";
    await put({ kind: "team", slug: "a-team", name: "A Team", follow: true });
    await put({ kind: "school", slug: "b-school", name: "B School", follow: true });
    const mine = await (await state("")).json();
    expect(mine.signedIn).toBe(true);
    expect(mine.follows.map((f: { slug: string }) => f.slug).sort()).toEqual(["a-team", "b-school"]);

    signedInAs = null;
    expect(await (await state("")).json()).toEqual({ follows: [], signedIn: false });
  });

  it("rejects a state lookup with a bad kind or slug", async () => {
    expect((await state("?kind=team")).status).toBe(400);
    expect((await state("?kind=nope&slug=x")).status).toBe(400);
    expect((await state("?kind=team&slug=Not%20ok")).status).toBe(400);
  });

  it("answers 409 once an account follows the maximum, but still lets it re-follow one it has", async () => {
    signedInAs = "alex";
    await db.insert(schema.profileFollows).values(
      Array.from({ length: MAX_FOLLOWS_PER_USER }, (_, i) => ({ userId: "alex", kind: "team", slug: `team-${i}`, name: `Team ${i}` })),
    );
    const over = await put({ kind: "team", slug: "one-too-many", name: "One", follow: true });
    expect(over.status).toBe(409);
    expect((await over.json()).error).toContain(String(MAX_FOLLOWS_PER_USER));
    expect((await put({ kind: "team", slug: "team-3", name: "Team 3", follow: true })).status).toBe(200);
  });
});

describe("/api/flow-presence", () => {
  const beat = (body: unknown) => call(presence.POST, req("/api/flow-presence", "POST", body));
  const room = (flowId: string) => call(presence.GET, req(`/api/flow-presence?flowId=${flowId}`));

  it("validates a heartbeat", async () => {
    expect((await beat("{nope")).status).toBe(400);
    expect((await beat({ flowId: 1.5, authorId: "a", lastSeenAt: 1 })).status).toBe(400);
    expect((await beat({ flowId: "x", authorId: "a", lastSeenAt: 1 })).status).toBe(400);
    expect((await beat({ flowId: 1, authorId: "   ", lastSeenAt: 1 })).status).toBe(400);
    expect((await beat({ flowId: 1, authorId: "a", lastSeenAt: "later" })).status).toBe(400);
    expect(await db.select().from(schema.flowPresenceHeartbeats)).toEqual([]);
  });

  it("keeps one row per collaborator per flow, updating it on a repeat heartbeat", async () => {
    const first = await beat({ flowId: 7, authorId: " ana ", lastSeenAt: 100 });
    expect(first.status).toBe(201);
    expect(await first.json()).toEqual({ flowId: 7, authorId: "ana", lastSeenAt: 100 });
    await beat({ flowId: 7, authorId: "ana", lastSeenAt: 250 });
    await beat({ flowId: 7, authorId: "ben", lastSeenAt: 200 });
    await beat({ flowId: 8, authorId: "ana", lastSeenAt: 300 });

    const { heartbeats } = await (await room("7")).json();
    expect(heartbeats.sort((a: { authorId: string }, b: { authorId: string }) => a.authorId.localeCompare(b.authorId))).toEqual([
      { flowId: 7, authorId: "ana", lastSeenAt: 250 },
      { flowId: 7, authorId: "ben", lastSeenAt: 200 },
    ]);
  });

  it("requires a whole-number flow id to read a room", async () => {
    expect((await room("")).status).toBe(400);
    expect((await room("abc")).status).toBe(400);
    expect((await room("1.5")).status).toBe(400);
    expect(await (await room("999")).json()).toEqual({ heartbeats: [] });
  });
});

describe("/api/market/publishers", () => {
  const create = (body: unknown) => call(publishers.POST, req("/api/market/publishers", "POST", body));

  it("lists nothing when signed out, and the viewer's own publishers when signed in", async () => {
    expect(await (await call(publishers.GET, req("/api/market/publishers"))).json()).toEqual({ publishers: [] });

    signedInAs = "alex";
    await create({ name: "Zeta Lab" });
    await create({ name: "Alpha Lab", priceCents: 500 });
    signedInAs = "sam";
    await create({ name: "Sam's Lab" });

    signedInAs = "alex";
    const { publishers: mine } = await (await call(publishers.GET, req("/api/market/publishers"))).json();
    expect(mine.map((p: { name: string }) => p.name)).toEqual(["Alpha Lab", "Zeta Lab"]);
  });

  it("refuses to create one when signed out, for an unknown account, or for a guest", async () => {
    expect((await create({ name: "Lab" })).status).toBe(401);
    signedInAs = "ghost";
    expect((await create({ name: "Lab" })).status).toBe(401);

    await addUser("guest", true);
    signedInAs = "guest";
    const guest = await create({ name: "Lab" });
    expect(guest.status).toBe(403);
    expect((await guest.json()).error).toBe("Create an account to publish research.");
  });

  it("validates the request body", async () => {
    signedInAs = "alex";
    expect((await create("{nope")).status).toBe(400);
    const nameless = await create({ name: "   " });
    expect(nameless.status).toBe(400);
    expect((await nameless.json()).error).toBe("Give the publisher a name.");
    expect((await create({ name: "Lab", website: "ftp://lab" })).status).toBe(400);
    expect(await db.select().from(schema.researchPublishers)).toEqual([]);
  });

  it("creates a publisher owned by the viewer and gives a repeated name a distinct slug", async () => {
    signedInAs = "alex";
    const first = await create({ name: "Westwood Lab", students: ["Ana"], priceCents: 500 });
    expect(first.status).toBe(201);
    const { publisher } = await first.json();
    expect(publisher).toMatchObject({ name: "Westwood Lab", students: ["Ana"], priceCents: 500, owner: { id: "alex" } });

    signedInAs = "sam";
    const second = await (await create({ name: "Westwood Lab" })).json();
    expect(second.publisher.slug).not.toBe(publisher.slug);
    expect(second.publisher.owner.id).toBe("sam");
  });
});
