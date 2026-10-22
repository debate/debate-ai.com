/**
 * @fileoverview `/api/video-ai-results` against a real SQLite database: the
 * watch page's AI results are public to read, saved once per video and key by
 * the first signed-in viewer, and replaced or cleared only by staff.
 */

import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;
let signedInAs: string | null = null;
let isStaff = false;

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({ getUserId: async () => signedInAs }));
vi.mock("@/lib/auth/admin", () => ({ getStaffAccess: async () => ({ canEditContent: isStaff }) }));

const route = await import("@/app/api/video-ai-results/route");

const videoId = "dQw4w9WgXcQ";
const req = (path: string, init?: RequestInit) => new Request(`https://debate-ai.com${path}`, init) as never;
const post = (body: unknown) =>
  route.POST(req("/api/video-ai-results", { method: "POST", body: JSON.stringify(body) }));
const read = async () => (await route.GET(req(`/api/video-ai-results?videoId=${videoId}`))).json();
const segmentation = (start: number) => ({ format: "policy", speeches: [{ name: "1AC", startSeconds: start, endSeconds: null }] });

describe("/api/video-ai-results", () => {
  beforeEach(async () => {
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values(["alex", "sam", "admin"].map((id) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })));
    signedInAs = null;
    isStaff = false;
  });

  it("is empty, and public, before anyone runs anything", async () => {
    const res = await route.GET(req(`/api/video-ai-results?videoId=${videoId}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ segmentation: null, summaries: {}, outcomes: {} });
    expect((await route.GET(req("/api/video-ai-results?videoId=bad"))).status).toBe(400);
  });

  it("needs a session to share", async () => {
    expect((await post({ videoId, kind: "summary", key: "1AC#1", data: "- x" })).status).toBe(401);
  });

  it("keeps the first result and answers later ones with it", async () => {
    signedInAs = "alex";
    const first = await post({ videoId, kind: "segmentation", data: segmentation(30), replace: true });
    expect(await first.json()).toMatchObject({ stored: true });

    signedInAs = "sam";
    const second = await (await post({ videoId, kind: "segmentation", data: segmentation(90), replace: true })).json();
    expect(second).toMatchObject({ stored: false, item: { kind: "segmentation", data: segmentation(30) } });

    await post({ videoId, kind: "summary", key: "1AC#1", data: "- Inherency" });
    signedInAs = null;
    expect(await read()).toMatchObject({
      segmentation: { speeches: [{ startSeconds: 30 }] },
      summaries: { "1AC#1": "- Inherency" },
    });
  });

  it("rejects what the parsers would not accept", async () => {
    signedInAs = "alex";
    const res = await post({ videoId, kind: "outcome", key: "1AR#1::flow", data: { nope: true } });
    expect(res.status).toBe(400);
  });

  it("lets staff replace and clear a shared result", async () => {
    signedInAs = "alex";
    await post({ videoId, kind: "segmentation", data: segmentation(30) });
    signedInAs = "admin";
    isStaff = true;
    expect(await (await post({ videoId, kind: "segmentation", data: segmentation(45), replace: true })).json()).toMatchObject({ stored: true });
    expect((await read()).segmentation.speeches[0].startSeconds).toBe(45);

    isStaff = false;
    expect((await route.DELETE(req(`/api/video-ai-results?videoId=${videoId}&kind=segmentation`, { method: "DELETE" }))).status).toBe(403);
    isStaff = true;
    expect((await route.DELETE(req(`/api/video-ai-results?videoId=${videoId}&kind=segmentation`, { method: "DELETE" }))).status).toBe(200);
    expect((await read()).segmentation).toBeNull();
  });
});
