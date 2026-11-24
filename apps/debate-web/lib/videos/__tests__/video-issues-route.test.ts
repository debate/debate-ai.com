/**
 * @fileoverview `/api/video-issues` against a real SQLite database: viewer
 * reports (open to signed-out viewers), signed-in change requests and library
 * submissions (which ping every moderator), and the staff-only listing and
 * resolution.
 */

import { drizzle } from "drizzle-orm/libsql";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;
let sessionEmail: string | null = null;
let staff = { canEditContent: false, email: null as string | null };
let dbFails = false;
const oembed = vi.fn(async (_id: string) => ({ title: "Looked-up title", channel: "Looked-up channel" }) as { title: string; channel: string } | null);

vi.mock("@/lib/database/context", () => ({
  getDBFromContext: async () => {
    if (dbFails) throw new Error("D1 unavailable");
    return db;
  },
}));
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => (sessionEmail ? { user: { email: sessionEmail } } : null),
}));
vi.mock("@/lib/auth/admin", () => ({
  getAdminEmails: () => ["admin@example.com"],
  getStaffAccess: async () => staff,
}));
vi.mock("@debate-ai/webview/lib/videos/video-submissions", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchYouTubeOEmbed: (id: string) => oembed(id),
}));

const { GET, PATCH, POST } = await import("@/app/api/video-issues/route");

const VIDEO = "qx7Xx_6exzk";
const url = "https://debate-ai.com/api/video-issues";
const post = (body: unknown) =>
  POST(new NextRequest(url, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
const patch = (body: unknown) =>
  PATCH(new NextRequest(url, { method: "PATCH", body: typeof body === "string" ? body : JSON.stringify(body) }));
const get = (query = "") => GET(new NextRequest(`${url}${query}`));
const issues = () => db.select().from(schema.videoIssues);
const notifications = () => db.select().from(schema.notifications);

beforeEach(async () => {
  sessionEmail = null;
  staff = { canEditContent: false, email: null };
  dbFails = false;
  oembed.mockClear();
  db = drizzle(await freshSchemaClient(), { schema });
  const now = new Date();
  await db.insert(schema.user).values({ id: "admin", name: "Admin", email: "admin@example.com", createdAt: now, updatedAt: now });
});

describe("POST viewer reports", () => {
  it("rejects a body that is not JSON", async () => {
    expect((await post("{not json")).status).toBe(400);
  });

  it.each(["", "short", "has spaces!", "12345678901234"])("rejects the video id %j", async (videoId) => {
    expect((await post({ videoId, issue: "broken" })).status).toBe(400);
  });

  it("files a signed-out report with no reporter, and an unknown kind as other", async () => {
    const res = await post({ videoId: VIDEO, kind: "nonsense", issue: "  embed is dead  ", title: "NDT Finals" });
    expect(res.status).toBe(200);
    const body = await res.json();
    const [row] = await issues();
    expect(row).toMatchObject({ id: body.id, videoId: VIDEO, kind: "other", issue: "embed is dead", title: "NDT Finals", reportedBy: null, status: "open" });
  });

  it("records the signed-in reporter's email lowercased", async () => {
    sessionEmail = "Viewer@Example.com";
    await post({ videoId: VIDEO, kind: "unavailable", issue: "gone" });
    expect((await issues())[0].reportedBy).toBe("viewer@example.com");
  });

  it("requires prose or a correction", async () => {
    const res = await post({ videoId: VIDEO, kind: "miscategorized", issue: "   " });
    expect(res.status).toBe(400);
    expect(await issues()).toHaveLength(0);
  });

  it("accepts a correction alone and keeps only valid suggested fields", async () => {
    await post({
      videoId: VIDEO,
      kind: "miscategorized",
      suggestedStyle: "3",
      suggestedCategory: "Topic Lectures",
      suggestedRoundLevel: "high-school",
    });
    await post({
      videoId: VIDEO,
      kind: "miscategorized",
      issue: "wrong",
      suggestedStyle: 42,
      suggestedCategory: "Not a category",
      suggestedRoundLevel: "kindergarten",
    });
    const [first, second] = await issues();
    expect(first).toMatchObject({ suggestedStyle: 3, suggestedCategory: "Topic Lectures", suggestedRoundLevel: "high-school" });
    expect(second).toMatchObject({ suggestedStyle: null, suggestedCategory: null, suggestedRoundLevel: null });
  });

  it("clips an overlong title and issue", async () => {
    await post({ videoId: VIDEO, issue: "x".repeat(5000), title: "t".repeat(1000) });
    const [row] = await issues();
    expect(row.issue).toHaveLength(2000);
    expect(row.title).toHaveLength(300);
  });

  it("answers 500 when the write fails", async () => {
    dbFails = true;
    expect((await post({ videoId: VIDEO, issue: "x" })).status).toBe(500);
  });
});

describe("POST change requests", () => {
  it("needs an account", async () => {
    expect((await post({ videoId: VIDEO, kind: "delete", reason: "dupe" })).status).toBe(401);
    expect((await post({ videoId: VIDEO, kind: "edit", proposedChanges: { title: "x" } })).status).toBe(401);
  });

  it("files a delete request and notifies the moderators", async () => {
    sessionEmail = "editor@example.com";
    const res = await post({ videoId: VIDEO, kind: "delete", reason: "duplicate upload", title: "NDT" });
    expect(res.status).toBe(200);
    const [row] = await issues();
    expect(row).toMatchObject({ kind: "delete", issue: "duplicate upload", reportedBy: "editor@example.com" });
    const [note] = await notifications();
    expect(note).toMatchObject({ userId: "admin", title: "Video deletion requested" });
    expect(note.body).toContain("asked to delete “NDT”");
  });

  it("stores an edit's sanitized changes and reason as JSON, dropping unknown fields", async () => {
    sessionEmail = "editor@example.com";
    await post({ videoId: VIDEO, kind: "edit", reason: "typo", proposedChanges: { title: "Fixed title", hacker: "x", style: 99 } });
    const [row] = await issues();
    expect(JSON.parse(row.issue)).toEqual({ changes: { title: "Fixed title" }, reason: "typo" });
    const [note] = await notifications();
    expect(note.title).toBe("Video edit suggested");
    // No title given: the body names the video by id.
    expect(note.body).toContain(`“${VIDEO}”`);
  });

  it("rejects an edit that changes nothing usable", async () => {
    sessionEmail = "editor@example.com";
    for (const proposedChanges of [undefined, null, [], { hacker: 1 }]) {
      expect((await post({ videoId: VIDEO, kind: "edit", proposedChanges })).status).toBe(400);
    }
    expect(await issues()).toHaveLength(0);
  });

  it("rejects an edit too long to store", async () => {
    sessionEmail = "editor@example.com";
    const proposedChanges = { title: "t".repeat(4000), description: "d".repeat(5000), channel: "c".repeat(4000) };
    const res = await post({ videoId: VIDEO, kind: "edit", reason: "r".repeat(2000), proposedChanges });
    expect(res.status).toBe(400);
  });

  it("answers 500 when the database is down", async () => {
    sessionEmail = "editor@example.com";
    dbFails = true;
    expect((await post({ videoId: VIDEO, kind: "delete" })).status).toBe(500);
  });
});

describe("POST library submissions", () => {
  it("needs an account", async () => {
    expect((await post({ kind: "submit-video", url: `https://youtu.be/${VIDEO}` })).status).toBe(401);
  });

  it("rejects a link that is not a YouTube video", async () => {
    sessionEmail = "fan@example.com";
    expect((await post({ kind: "submit-video", url: "https://vimeo.com/123" })).status).toBe(400);
  });

  it("looks up a missing title and channel, and needs no library video id check", async () => {
    sessionEmail = "fan@example.com";
    const res = await post({ kind: "submit-video", url: `https://www.youtube.com/watch?v=${VIDEO}`, note: "great round" });
    expect(res.status).toBe(200);
    expect(oembed).toHaveBeenCalledWith(VIDEO);
    const [row] = await issues();
    expect(row).toMatchObject({ kind: "submit-video", videoId: VIDEO, title: "Looked-up title" });
    expect(JSON.parse(row.issue)).toEqual({ url: `https://www.youtube.com/watch?v=${VIDEO}`, channel: "Looked-up channel", note: "great round" });
    expect((await notifications())[0].title).toBe("Video submitted");
  });

  it("skips the lookup when title and channel are given, and survives a failed lookup", async () => {
    sessionEmail = "fan@example.com";
    await post({ kind: "submit-video", url: VIDEO, title: "Mine", channel: "Me" });
    expect(oembed).not.toHaveBeenCalled();
    oembed.mockResolvedValueOnce(null);
    await post({ kind: "submit-video", url: `https://youtu.be/${VIDEO}` });
    const rows = await issues();
    expect(rows.map((r) => r.title).sort()).toEqual(["", "Mine"]);
  });

  it("files a channel by link or by @handle, and rejects anything else", async () => {
    sessionEmail = "fan@example.com";
    expect((await post({ kind: "submit-channel", url: "https://www.youtube.com/@debatedrills" })).status).toBe(200);
    expect((await post({ kind: "submit-channel", name: "@nsda" })).status).toBe(200);
    expect((await post({ kind: "submit-channel", url: "https://example.com/@x" })).status).toBe(400);
    const rows = await issues();
    expect(rows.map((r) => r.title).sort()).toEqual(["@debatedrills", "@nsda"]);
    expect(rows.every((r) => r.videoId === "")).toBe(true);
    expect((await notifications()).map((n) => n.title)).toEqual(["Channel submitted", "Channel submitted"]);
  });

  it("answers 500 when the database is down", async () => {
    sessionEmail = "fan@example.com";
    dbFails = true;
    expect((await post({ kind: "submit-channel", name: "@nsda" })).status).toBe(500);
  });
});

describe("GET and PATCH for staff", () => {
  beforeEach(async () => {
    await post({ videoId: VIDEO, issue: "one" });
    await post({ videoId: "Afl7_hl-H0c", issue: "two" });
  });

  it("forbids non-staff", async () => {
    expect((await get()).status).toBe(403);
    expect((await patch({ id: "x", status: "applied" })).status).toBe(403);
  });

  it("lists open reports by default, filters by video, and clamps the limit", async () => {
    staff = { canEditContent: true, email: "mod@example.com" };
    expect((await (await get()).json()).issues).toHaveLength(2);
    expect((await (await get(`?videoId=${VIDEO}`)).json()).issues.map((i: { issue: string }) => i.issue)).toEqual(["one"]);
    expect((await (await get("?limit=0")).json()).issues).toHaveLength(2);
    expect((await (await get("?limit=1")).json()).issues).toHaveLength(1);
  });

  it("resolves a report, hides it from the open list, and can reopen it", async () => {
    staff = { canEditContent: true, email: "mod@example.com" };
    const [row] = (await issues()).filter((r) => r.issue === "one");

    const res = await patch({ id: row.id, status: "dismissed" });
    expect(await res.json()).toEqual({ ok: true, id: row.id, status: "dismissed" });
    const [resolved] = (await issues()).filter((r) => r.id === row.id);
    expect(resolved.resolvedBy).toBe("mod@example.com");
    expect(resolved.resolvedAt).toBeInstanceOf(Date);
    expect((await (await get()).json()).issues).toHaveLength(1);
    expect((await (await get("?status=dismissed")).json()).issues).toHaveLength(1);
    expect((await (await get("?status=all")).json()).issues).toHaveLength(2);

    await patch({ id: row.id, status: "open" });
    const [reopened] = (await issues()).filter((r) => r.id === row.id);
    expect(reopened).toMatchObject({ status: "open", resolvedBy: null, resolvedAt: null });
  });

  it("validates the PATCH body", async () => {
    staff = { canEditContent: true, email: "mod@example.com" };
    expect((await patch("nope")).status).toBe(400);
    expect((await patch({ status: "applied" })).status).toBe(400);
    expect((await patch({ id: "x", status: "deleted" })).status).toBe(400);
  });

  it("lists nothing rather than failing on an unreachable database, but reports a failed update", async () => {
    staff = { canEditContent: true, email: "mod@example.com" };
    dbFails = true;
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ issues: [] });
    expect((await patch({ id: "x", status: "applied" })).status).toBe(500);
  });
});
