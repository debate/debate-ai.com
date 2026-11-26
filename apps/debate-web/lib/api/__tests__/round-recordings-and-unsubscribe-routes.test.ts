/**
 * @fileoverview `/api/round-recordings` (upload and list, against an in-memory
 * bucket) and `/api/emails/unsubscribe` (signed-link and settings flows,
 * against a real SQLite database).
 */

import { NextRequest } from "next/server";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>> | null;
let signedInAs: string | null = "alex";
let sessionEmail: string | null = "alex@example.com";
let bucket: ReturnType<typeof memoryBucket> | null;

function memoryBucket(pageSize = 1000) {
  const objects = new Map<string, { value: ArrayBuffer; contentType?: string }>();
  return {
    objects,
    put: vi.fn(async (key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }) => {
      objects.set(key, { value, contentType: options?.httpMetadata?.contentType });
    }),
    get: vi.fn(),
    list: vi.fn(async ({ prefix, cursor }: { prefix: string; cursor?: string }) => {
      const keys = [...objects.keys()].filter((key) => key.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const page = keys.slice(start, start + pageSize);
      const truncated = start + pageSize < keys.length;
      return {
        objects: page.map((key) => ({ key, size: objects.get(key)!.value.byteLength, uploaded: new Date("2026-01-02T03:04:05Z") })),
        truncated,
        cursor: truncated ? String(start + pageSize) : undefined,
      };
    }),
  };
}

vi.mock("@/lib/database/context", () => ({
  getCloudflareContext: () => null,
  getDBFromContext: async () => {
    if (!db) throw new Error("no database");
    return db;
  },
}));
vi.mock("@/lib/auth/session", () => ({
  getUserId: async () => signedInAs,
  getSession: async () => (signedInAs ? { user: { id: signedInAs, email: sessionEmail } } : null),
}));
vi.mock("@/lib/round-recordings/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/round-recordings/storage")>()),
  getRoundRecordingsBucket: () => bucket,
}));

const recordings = await import("@/app/api/round-recordings/route");
const unsubscribe = await import("@/app/api/emails/unsubscribe/route");
const { signUnsubscribeToken, isEmailUnsubscribed } = await import("@/lib/emails/unsubscribe");

const upload = async (query: string, body: BodyInit | null, headers: Record<string, string> = {}) =>
  (await recordings.PUT(
    new Request(`https://debate-ai.com/api/round-recordings?${query}`, { method: "PUT", body, headers }),
  ))!;
const list = async (query: string) =>
  (await recordings.GET(new Request(`https://debate-ai.com/api/round-recordings?${query}`)))!;

describe("/api/round-recordings", () => {
  beforeEach(() => {
    signedInAs = "alex";
    bucket = memoryBucket();
  });

  it("needs a session and a configured bucket", async () => {
    signedInAs = null;
    expect((await upload("roundId=r1&name=a.webm", "x", { "content-type": "video/webm" })).status).toBe(401);
    expect((await list("roundId=r1")).status).toBe(401);
    signedInAs = "alex";
    bucket = null;
    const res = await list("roundId=r1");
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("Recording storage is not configured");
  });

  it("stores an upload under the caller's own folder", async () => {
    const res = await upload("roundId=r1&name=speech.webm", "bytes", { "content-type": "video/webm; codecs=vp9" });
    expect(await res.json()).toEqual({ key: "round-recordings/alex/r1/speech.webm" });
    const stored = bucket!.objects.get("round-recordings/alex/r1/speech.webm");
    expect(stored?.contentType).toBe("video/webm; codecs=vp9");
    expect(stored?.value.byteLength).toBe(5);
  });

  it("rejects bad ids and names, disallowed types, empty bodies and oversized uploads", async () => {
    const webm = { "content-type": "video/webm" };
    expect((await upload("roundId=../x&name=a.webm", "x", webm)).status).toBe(400);
    expect((await upload("roundId=r1&name=..%2Fa.webm", "x", webm)).status).toBe(400);
    expect((await upload("roundId=r1", "x", webm)).status).toBe(400);
    expect((await upload("roundId=r1&name=a.exe", "x", { "content-type": "application/x-msdownload" })).status).toBe(415);
    expect((await upload("roundId=r1&name=a.webm", "x", { "content-length": String(96 * 1024 * 1024), ...webm })).status).toBe(413);
    expect((await upload("roundId=r1&name=a.webm", null, webm)).status).toBe(400);
    expect((await upload("roundId=r1&name=a.webm", "", webm)).status).toBe(400);
    expect(bucket!.objects.size).toBe(0);
  });

  it("lists only the caller's files for a round, following pagination", async () => {
    bucket = memoryBucket(2);
    for (const name of ["a.webm", "b.webm", "c.json"]) {
      await upload(`roundId=r1&name=${name}`, "x", { "content-type": name.endsWith("json") ? "application/json" : "video/webm" });
    }
    await upload("roundId=r2&name=other.webm", "x", { "content-type": "video/webm" });
    signedInAs = "sam";
    await upload("roundId=r1&name=sams.webm", "x", { "content-type": "video/webm" });
    signedInAs = "alex";

    const res = await list("roundId=r1");
    const { files } = await res.json();
    expect(files.map((file: { name: string }) => file.name)).toEqual(["a.webm", "b.webm", "c.json"]);
    expect(files[0]).toMatchObject({ key: "round-recordings/alex/r1/a.webm", size: 1, uploaded: "2026-01-02T03:04:05.000Z" });
    expect(bucket.list).toHaveBeenCalledTimes(2);
    expect((await list("roundId=bad/id")).status).toBe(400);
  });
});

describe("/api/emails/unsubscribe", () => {
  const post = (body: unknown) =>
    unsubscribe.POST(
      new NextRequest("https://debate-ai.com/api/emails/unsubscribe", {
        method: "POST",
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    );
  const get = (token: string) =>
    unsubscribe.GET(new NextRequest(`https://debate-ai.com/api/emails/unsubscribe?t=${encodeURIComponent(token)}`));

  beforeEach(async () => {
    signedInAs = "alex";
    sessionEmail = "alex@example.com";
    db = drizzle(await freshSchemaClient(), { schema });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("reports the state behind a signed link, and refuses a bad one", async () => {
    const token = signUnsubscribeToken("Reader@Example.com");
    expect(await (await get(token)).json()).toEqual({ email: "reader@example.com", unsubscribed: false });
    const bad = await get("garbage");
    expect(bad.status).toBe(400);
    expect((await get(`${token}x`)).status).toBe(400);
    db = null;
    expect((await get(token)).status).toBe(503);
  });

  it("unsubscribes and resubscribes through a signed link", async () => {
    const token = signUnsubscribeToken("reader@example.com");
    expect(await (await post({ token })).json()).toEqual({ email: "reader@example.com", unsubscribed: true });
    expect(await isEmailUnsubscribed(db!, "reader@example.com")).toBe(true);
    expect(await (await get(token)).json()).toEqual({ email: "reader@example.com", unsubscribed: true });

    expect(await (await post({ token, action: "resubscribe" })).json()).toEqual({ email: "reader@example.com", unsubscribed: false });
    expect(await isEmailUnsubscribed(db!, "reader@example.com")).toBe(false);
    expect((await post({ token: "garbage" })).status).toBe(400);
  });

  it("uses the signed-in account's email from settings, or one given explicitly", async () => {
    await post({});
    const [row] = await db!.select().from(schema.emailUnsubscribes);
    expect(row).toMatchObject({ email: "alex@example.com", source: "settings" });

    await post({ email: " Other@Example.com " });
    expect(await isEmailUnsubscribed(db!, "other@example.com")).toBe(true);
  });

  it("explains why it cannot act without a token or a usable email", async () => {
    expect((await post("{nope")).status).toBe(400);
    signedInAs = null;
    const anonymous = await post({});
    expect(anonymous.status).toBe(401);
    expect((await anonymous.json()).error).toBe("Sign in or provide a valid unsubscribe token.");

    const invalid = await post({ email: "not-an-email" });
    expect(invalid.status).toBe(401);

    signedInAs = "alex";
    sessionEmail = null;
    const noEmail = await post({});
    expect(noEmail.status).toBe(400);
    expect((await noEmail.json()).error).toBe("Your account has no email on file.");
  });

  it("reports a database failure as 503 and a write failure as 500", async () => {
    db = null;
    expect((await post({ email: "a@example.com" })).status).toBe(503);
    db = drizzle(await freshSchemaClient(), { schema });
    vi.spyOn(db, "insert").mockImplementation(() => {
      throw new Error("write failed");
    });
    const res = await post({ email: "a@example.com" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Could not update email preferences." });
  });
});
