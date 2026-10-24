/**
 * @fileoverview `/api/settings/privacy` and its deletion-requests route
 * against a real SQLite database: the recording release is stored per
 * account, agreement is stamped, bad input is refused, and deletion
 * requests are filed, listed only to their owner, and ping the admins.
 */

import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";
import { RECORDING_RELEASE_VERSION } from "@debate-ai/webview/lib/privacy/recording-release";

let db: ReturnType<typeof drizzle<typeof schema>>;
let signedInAs: string | null = "user-1";

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({ getUserId: async () => signedInAs }));
vi.mock("@/lib/auth/admin", () => ({ getAdminEmails: () => ["admin@example.com"] }));

const privacyRoute = await import("@/app/api/settings/privacy/route");
const deletionRoute = await import("@/app/api/settings/privacy/deletion-requests/route");

const put = (body: unknown) =>
  privacyRoute.PUT(new Request("http://x/api/settings/privacy", { method: "PUT", body: JSON.stringify(body) }));
const post = (body: unknown) =>
  deletionRoute.POST(
    new Request("http://x/api/settings/privacy/deletion-requests", { method: "POST", body: JSON.stringify(body) }),
  );

describe("/api/settings/privacy", () => {
  beforeEach(async () => {
    signedInAs = "user-1";
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values(
      ["user-1", "user-2", "admin"].map((id) => ({
        id,
        name: id,
        email: `${id}@example.com`,
        createdAt: now,
        updatedAt: now,
      })),
    );
  });

  it("starts unpublished and anonymous", async () => {
    const { privacy } = await (await privacyRoute.GET()).json();
    expect(privacy).toMatchObject({ release: "not-released", credit: "anonymous", media: "audio-video" });
  });

  it("rejects signed-out reads and writes", async () => {
    signedInAs = null;
    expect((await privacyRoute.GET()).status).toBe(401);
    expect((await put({ release: "released" })).status).toBe(401);
    expect((await deletionRoute.GET()).status).toBe(401);
    expect((await post({ scope: "all" })).status).toBe(401);
  });

  it("stores the release with its version and keeps other settings", async () => {
    await db.insert(schema.userSettings).values({ userId: "user-1", fontSize: 18 });
    const res = await put({ release: "released", media: "audio-only", credit: "username", username: "debater_7" });
    expect(res.status).toBe(200);
    const [row] = await db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, "user-1"));
    expect(row.fontSize).toBe(18);
    const stored = JSON.parse(row.recordingPrivacy!);
    expect(stored).toMatchObject({ release: "released", media: "audio-only", credit: "username", username: "debater_7" });
    expect(stored.releaseVersion).toBe(RECORDING_RELEASE_VERSION);
    signedInAs = "user-2";
    expect((await (await privacyRoute.GET()).json()).privacy.release).toBe("not-released");
  });

  it("refuses an invalid patch without saving it", async () => {
    const res = await put({ credit: "username" });
    expect(res.status).toBe(400);
    expect((await (await privacyRoute.GET()).json()).privacy.credit).toBe("anonymous");
  });

  it("files deletion requests, lists them to their owner and notifies admins", async () => {
    expect((await post({ scope: "part" })).status).toBe(400);
    const res = await post({ scope: "part", categories: ["recordings"], details: "My round at Glenbrooks" });
    expect(res.status).toBe(201);
    const { requests } = await (await deletionRoute.GET()).json();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ scope: "part", categories: ["recordings"], status: "pending" });
    const pinged = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, "admin"));
    expect(pinged).toHaveLength(1);
    signedInAs = "user-2";
    expect((await (await deletionRoute.GET()).json()).requests).toHaveLength(0);
  });
});
