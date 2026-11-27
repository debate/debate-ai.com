/**
 * @fileoverview `/api/comments`, `/api/comments/[commentId]` and its like route
 * against a real SQLite database: threads are public to read, writing needs an
 * account, replies are validated against the page they answer, and only the
 * author can delete a comment.
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

const comments = await import("@/app/api/comments/route");
const one = await import("@/app/api/comments/[commentId]/route");
const like = await import("@/app/api/comments/[commentId]/like/route");

const url = "https://debate-ai.com/api/comments";
const post = (body: unknown) =>
  comments.POST(new NextRequest(url, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
const list = (query: string) => comments.GET(new NextRequest(`${url}?${query}`));
const ctx = (commentId: string) => ({ params: Promise.resolve({ commentId }) });
const remove = (id: string) => one.DELETE(new NextRequest(`${url}/${id}`, { method: "DELETE" }), ctx(id));
const toggleLike = (id: string) => like.POST(new NextRequest(`${url}/${id}/like`, { method: "POST" }), ctx(id));

const page = { resourceType: "video", resourceId: "dQw4w9WgXcQ" };

describe("/api/comments", () => {
  beforeEach(async () => {
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values(["alex", "sam"].map((id) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })));
    signedInAs = null;
    sessionFails = false;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("validates what a thread is asked for", async () => {
    expect((await list("resourceId=x")).status).toBe(400);
    expect(await (await list("resourceType=nope&resourceId=x")).json()).toEqual({ error: "Unknown kind of thing to comment on." });
    expect((await list("resourceType=video")).status).toBe(400);
  });

  it("reads an empty thread without a session, even when the session lookup throws", async () => {
    sessionFails = true;
    const res = await list("resourceType=video&resourceId=dQw4w9WgXcQ");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ comments: [], viewer: null });
  });

  it("needs a session and a JSON body to comment", async () => {
    expect((await post({ ...page, body: "hi" })).status).toBe(401);
    signedInAs = "alex";
    expect((await post("{nope")).status).toBe(400);
  });

  it("reports the first thing wrong with a new comment", async () => {
    signedInAs = "alex";
    expect(await (await post({ body: "hi" })).json()).toEqual({ error: "Unknown kind of thing to comment on." });
    expect((await post({ resourceType: "video", body: "hi" })).status).toBe(400);
    expect((await post({ ...page, body: "   " })).status).toBe(400);
    expect((await post({ ...page, parentId: 5, body: "hi" })).status).toBe(400);
  });

  it("stores a comment and a reply, which then appear nested to a signed-out reader", async () => {
    signedInAs = "alex";
    const top = await post({ ...page, body: "  First!  " });
    expect(top.status).toBe(201);
    const created = await top.json();
    expect(created).toMatchObject({ body: "First!" });

    signedInAs = "sam";
    const reply = await post({ ...page, parentId: created.id, body: "Second" });
    expect(reply.status).toBe(201);

    signedInAs = null;
    const thread = await (await list("resourceType=video&resourceId=dQw4w9WgXcQ")).json();
    expect(thread.comments).toHaveLength(1);
    expect(thread.comments[0].body).toBe("First!");
    expect(thread.comments[0].replies.map((r: { body: string }) => r.body)).toEqual(["Second"]);
  });

  it("will not graft a reply onto another page's comment or a missing one", async () => {
    signedInAs = "alex";
    const created = await (await post({ ...page, body: "here" })).json();
    const elsewhere = await post({ resourceType: "video", resourceId: "other-video", parentId: created.id, body: "wrong page" });
    expect(elsewhere.status).toBe(400);
    expect(await elsewhere.json()).toEqual({ error: "That is not a comment on this page." });
    const missing = await post({ ...page, parentId: crypto.randomUUID(), body: "to nobody" });
    expect(missing.status).toBe(400);
  });

  it("lets only the author delete a comment", async () => {
    signedInAs = "alex";
    const { id } = await (await post({ ...page, body: "mine" })).json();

    signedInAs = null;
    expect((await remove(id)).status).toBe(401);

    signedInAs = "sam";
    expect((await remove(id)).status).toBe(403);

    signedInAs = "alex";
    expect(await (await remove(id)).json()).toEqual({ deleted: true });
    expect((await remove(crypto.randomUUID())).status).toBe(404);
    expect((await remove("not-an-id")).status).toBe(404);
  });

  it("toggles a like, and answers 404 for a comment that is not there", async () => {
    signedInAs = "alex";
    const { id } = await (await post({ ...page, body: "likeable" })).json();

    signedInAs = null;
    expect((await toggleLike(id)).status).toBe(401);

    signedInAs = "sam";
    expect(await (await toggleLike(id)).json()).toMatchObject({ liked: true, likeCount: 1 });
    expect(await (await toggleLike(id)).json()).toMatchObject({ liked: false, likeCount: 0 });
    expect((await toggleLike(crypto.randomUUID())).status).toBe(404);
  });

  it("answers a thrown query with a 500 rather than leaking the error", async () => {
    signedInAs = "alex";
    db = { select: () => { throw new Error("boom"); } } as unknown as typeof db;
    const res = await post({ ...page, body: "hi" });
    expect(res.status).toBe(500);
  });
});
