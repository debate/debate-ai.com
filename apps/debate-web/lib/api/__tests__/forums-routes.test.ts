/**
 * @fileoverview `/api/forums`, `/api/forums/[threadId]` and its like route
 * against a real SQLite database: the feed is public, opening a thread needs an
 * account and valid fields, and a thread can be fetched and liked by id.
 */

import { NextRequest } from "next/server";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;
let signedInAs: string | null = null;
let sessionFails = false;

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({
  getUserId: async () => {
    if (sessionFails) throw new Error("session lookup failed");
    return signedInAs;
  },
}));

const feed = await import("@/app/api/forums/route");
const thread = await import("@/app/api/forums/[threadId]/route");
const like = await import("@/app/api/forums/[threadId]/like/route");

const url = "https://debate-ai.com/api/forums";
const open = (body: unknown) =>
  feed.POST(new NextRequest(url, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
const list = (query = "") => feed.GET(new NextRequest(`${url}?${query}`));
const ctx = (threadId: string) => ({ params: Promise.resolve({ threadId }) });
const getThread = (id: string) => thread.GET(new NextRequest(`${url}/${id}`), ctx(id));
const toggleLike = (id: string) => like.POST(new NextRequest(`${url}/${id}/like`, { method: "POST" }), ctx(id));

describe("/api/forums", () => {
  beforeEach(async () => {
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values(["alex", "sam"].map((id) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })));
    signedInAs = null;
    sessionFails = false;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("serves an empty feed to a signed-out reader, even when the session lookup throws", async () => {
    sessionFails = true;
    const res = await list();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ threads: [], viewer: null });
  });

  it("rejects a bad cursor, category or JSON body, and a signed-out author", async () => {
    expect((await list("cursor=%%%")).status).toBe(400);
    expect((await list("category=nonsense")).status).toBe(400);
    expect((await open({ title: "T", body: "B" })).status).toBe(401);
    signedInAs = "alex";
    expect((await open("{nope")).status).toBe(400);
  });

  it("checks title, then body, then category", async () => {
    signedInAs = "alex";
    expect((await open({ body: "B" })).status).toBe(400);
    expect((await open({ title: "T" })).status).toBe(400);
    const badCategory = await open({ title: "T", body: "B", category: "nonsense" });
    expect(badCategory.status).toBe(400);
  });

  it("opens threads, files them by board and lists them newest or filtered", async () => {
    signedInAs = "alex";
    const first = await open({ title: "  Topic talk  ", body: "What do you think?", category: "policy" });
    expect(first.status).toBe(201);
    expect(await first.json()).toMatchObject({ title: "Topic talk", category: "policy" });
    const defaulted = await (await open({ title: "Anything", body: "Else" })).json();
    expect(defaulted.category).toBe("general");

    signedInAs = null;
    const all = await (await list("limit=10&sort=new")).json();
    expect(all.threads).toHaveLength(2);
    const policy = await (await list("category=policy")).json();
    expect(policy.threads.map((t: { title: string }) => t.title)).toEqual(["Topic talk"]);
    const everything = await (await list("category=all&sort=top")).json();
    expect(everything.threads).toHaveLength(2);
  });

  it("pages through the feed with the cursor", async () => {
    signedInAs = "alex";
    for (const title of ["one", "two", "three"]) await open({ title, body: "body" });
    const pageOne = await (await list("limit=2&sort=new")).json();
    expect(pageOne.threads).toHaveLength(2);
    expect(pageOne.nextCursor).toEqual(expect.any(String));
    const pageTwo = await (await list(`limit=2&sort=new&cursor=${encodeURIComponent(pageOne.nextCursor)}`)).json();
    expect(pageTwo.threads).toHaveLength(1);
    const titles = [...pageOne.threads, ...pageTwo.threads].map((t: { title: string }) => t.title);
    expect(new Set(titles).size).toBe(3);
  });

  it("fetches one thread by id and 404s for a missing one", async () => {
    signedInAs = "alex";
    const { id } = await (await open({ title: "Findable", body: "body" })).json();
    expect(await (await getThread(id)).json()).toMatchObject({ id, title: "Findable" });
    expect((await getThread(crypto.randomUUID())).status).toBe(404);
    expect(await (await getThread("not-a-uuid")).json()).toEqual({ error: "That is not a thread." });
  });

  it("toggles a thread like for a signed-in reader", async () => {
    signedInAs = "alex";
    const { id } = await (await open({ title: "Likeable", body: "body" })).json();

    signedInAs = null;
    expect((await toggleLike(id)).status).toBe(401);

    signedInAs = "sam";
    expect(await (await toggleLike(id)).json()).toMatchObject({ liked: true });
    expect(await (await getThread(id)).json()).toMatchObject({ viewerHasLiked: true });
    expect(await (await toggleLike(id)).json()).toMatchObject({ liked: false });
    expect((await toggleLike(crypto.randomUUID())).status).toBe(404);
  });
});
