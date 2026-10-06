/**
 * @fileoverview `/api/settings` `flowAutoSave` GET/PUT against a real SQLite
 * database: default null, validation, persistence, per-user isolation.
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

describe("/api/settings flowAutoSave", () => {
  beforeEach(async () => {
    signedInAs = "user-1";
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values(
      ["user-1", "user-2"].map((id) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })),
    );
  });

  it("is null until the account chooses a mode", async () => {
    expect((await (await get()).json()).flowAutoSave).toBeNull();
  });

  it("saves and returns each valid mode", async () => {
    for (const mode of ["all", "off", "saved"]) {
      expect((await put({ flowAutoSave: mode })).status).toBe(200);
      expect((await (await get()).json()).flowAutoSave).toBe(mode);
    }
  });

  it("rejects unknown modes without writing", async () => {
    await put({ flowAutoSave: "all" });
    expect((await put({ flowAutoSave: "sometimes" })).status).toBe(400);
    expect((await (await get()).json()).flowAutoSave).toBe("all");
  });

  it("does not disturb other settings", async () => {
    await put({ colorTheme: "cyberpunk" });
    await put({ flowAutoSave: "off" });
    const body = await (await get()).json();
    expect(body).toMatchObject({ colorTheme: "cyberpunk", flowAutoSave: "off" });
  });

  it("rejects signed-out access and isolates users", async () => {
    await put({ flowAutoSave: "all" });
    signedInAs = "user-2";
    expect((await (await get()).json()).flowAutoSave).toBeNull();
    signedInAs = null;
    expect((await put({ flowAutoSave: "off" })).status).toBe(401);
  });
});
