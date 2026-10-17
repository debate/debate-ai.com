/**
 * @fileoverview `/api/settings` `flowAutoSave` GET/PUT against a real
 * SQLite database: validation, persistence and per-user isolation.
 */

import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;
let signedInAs: string | null = "user-1";

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({ getUserId: async () => signedInAs }));

const { GET, PUT } = await import("@/app/api/settings/route");

function put(body: unknown) {
  return PUT(
    new Request("https://d.ebate.app/api/settings", {
      method: "PUT",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }) as never,
  );
}

const get = () => GET(new Request("https://d.ebate.app/api/settings") as never);

describe("/api/settings flowAutoSave", () => {
  beforeEach(async () => {
    signedInAs = "user-1";
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values(
      ["user-1", "user-2"].map((id) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })),
    );
  });

  it("is null until a device syncs a choice", async () => {
    expect((await (await get()).json()).flowAutoSave).toBeNull();
  });

  it("rejects signed-out writes", async () => {
    signedInAs = null;
    expect((await put({ flowAutoSave: "all" })).status).toBe(401);
  });

  it("saves each mode and returns it", async () => {
    for (const mode of ["all", "off", "saved"]) {
      const res = await put({ flowAutoSave: mode });
      expect(res.status).toBe(200);
      expect((await res.json()).flowAutoSave).toBe(mode);
      expect((await (await get()).json()).flowAutoSave).toBe(mode);
    }
  });

  it("rejects unknown modes without writing", async () => {
    await put({ flowAutoSave: "all" });
    expect((await put({ flowAutoSave: "always" })).status).toBe(400);
    expect((await (await get()).json()).flowAutoSave).toBe("all");
  });

  it("keeps each user's mode separate", async () => {
    await put({ flowAutoSave: "off" });
    signedInAs = "user-2";
    expect((await (await get()).json()).flowAutoSave).toBeNull();
  });
});
