/**
 * @fileoverview `/api/settings` `flowAutoSaveMode` GET/PUT against a real
 * SQLite database: null default, validation, persistence and per-user isolation.
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

const put = (body: unknown) =>
  PUT(new Request("https://d.ebate.app/api/settings", { method: "PUT", body: JSON.stringify(body) }) as never);
const get = () => GET(new Request("https://d.ebate.app/api/settings") as never);

describe("/api/settings flowAutoSaveMode", () => {
  beforeEach(async () => {
    signedInAs = "user-1";
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values(
      ["user-1", "user-2"].map((id) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })),
    );
  });

  it("returns null until a mode is chosen", async () => {
    expect((await (await get()).json()).flowAutoSaveMode).toBeNull();
  });

  it("saves and returns each mode", async () => {
    for (const mode of ["all", "off", "saved"]) {
      expect((await put({ flowAutoSaveMode: mode })).status).toBe(200);
      expect((await (await get()).json()).flowAutoSaveMode).toBe(mode);
    }
  });

  it("rejects an unknown mode without changing the stored one", async () => {
    await put({ flowAutoSaveMode: "all" });
    expect((await put({ flowAutoSaveMode: "sometimes" })).status).toBe(400);
    expect((await (await get()).json()).flowAutoSaveMode).toBe("all");
  });

  it("keeps modes per user", async () => {
    await put({ flowAutoSaveMode: "off" });
    signedInAs = "user-2";
    expect((await (await get()).json()).flowAutoSaveMode).toBeNull();
  });
});
