/**
 * @fileoverview `/api/url-detection` POST/GET against a real SQLite database
 * with foreign keys on (as D1 enforces them): visits are stored per signed-in
 * account and upserted per normalized URL, and signed-out calls get a 401
 * instead of the foreign-key 500 a literal `"anonymous"` user id caused.
 */

import { drizzle } from "drizzle-orm/libsql";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;
let signedInAs: string | null = "user-1";

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({ getUserId: async () => signedInAs }));

const { GET, POST } = await import("@/app/api/url-detection/route");

const post = (body: unknown) =>
  POST(new NextRequest("https://debate-ai.com/api/url-detection", { method: "POST", body: JSON.stringify(body) }));
const get = (query = "") => GET(new NextRequest(`https://debate-ai.com/api/url-detection${query}`));

describe("/api/url-detection", () => {
  beforeEach(async () => {
    signedInAs = "user-1";
    const client = await freshSchemaClient();
    await client.execute("PRAGMA foreign_keys = ON");
    db = drizzle(client, { schema });
    const now = new Date();
    await db.insert(schema.user).values(
      ["user-1", "user-2"].map((id) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })),
    );
  });

  it("rejects signed-out writes and reads with a 401, storing nothing", async () => {
    signedInAs = null;
    expect((await post({ url: "https://slate.com/a" })).status).toBe(401);
    expect((await get()).status).toBe(401);
    expect(await db.select().from(schema.detectedUrls)).toHaveLength(0);
  });

  it("stores a visit under the signed-in account and counts repeat visits", async () => {
    const first = await post({ url: "https://www.slate.com/a?x=1", title: "A" });
    expect(first.status).toBe(201);
    expect((await first.json()).visitCount).toBe(1);

    const again = await post({ url: "http://slate.com/a/", title: "A again" });
    expect((await again.json()).visitCount).toBe(2);

    const rows = await db.select().from(schema.detectedUrls);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: "user-1", normalizedUrl: "slate.com/a", title: "A again" });
  });

  it("lists only the signed-in account's visits, ignoring a userId query", async () => {
    await post({ url: "https://slate.com/a" });
    signedInAs = "user-2";
    await post({ url: "https://slate.com/b" });

    const body = await (await get("?userId=user-1")).json();
    expect(body.total).toBe(1);
    expect(body.urls.map((row: { normalizedUrl: string }) => row.normalizedUrl)).toEqual(["slate.com/b"]);
  });

  it("still validates the body", async () => {
    expect((await post({})).status).toBe(400);
  });
});
