/**
 * @fileoverview `/api/settings` `flowEditorSettings` GET/PUT against a real
 * SQLite database: validation, per-key merge across devices, and sign-in gate.
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

describe("/api/settings flowEditorSettings", () => {
  beforeEach(async () => {
    signedInAs = "user-1";
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values(
      ["user-1", "user-2"].map((id) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })),
    );
  });

  it("rejects signed-out reads and writes", async () => {
    signedInAs = null;
    expect((await get()).status).toBe(401);
    expect((await put({ flowEditorSettings: { rfdVim: true } })).status).toBe(401);
  });

  it("saves and returns valid settings", async () => {
    const res = await put({ flowEditorSettings: { rfdVim: true, defaultGridZoom: 1.5, keymapOverrides: { "a.b": "Mod-k" } } });
    expect(res.status).toBe(200);
    const body = await (await get()).json();
    expect(body.flowEditorSettings).toEqual({
      rfdVim: true,
      defaultGridZoom: 1.5,
      keymapOverrides: { "a.b": "Mod-k" },
    });
  });

  it("merges separate patches instead of overwriting", async () => {
    await put({ flowEditorSettings: { rfdVim: true } });
    await put({ flowEditorSettings: { tooltips: false } });
    const body = await (await get()).json();
    expect(body.flowEditorSettings).toMatchObject({ rfdVim: true, tooltips: false });
  });

  it("rejects unknown keys and invalid values without writing", async () => {
    for (const bad of [{ nope: 1 }, { rfdVim: "yes" }, { defaultGridZoom: 99 }, { affColor: "red" }, []]) {
      const res = await put({ flowEditorSettings: bad });
      expect(res.status).toBe(400);
    }
    const body = await (await get()).json();
    expect(body.flowEditorSettings).toEqual({});
  });

  it("rejects malformed JSON", async () => {
    expect((await put("{not json")).status).toBe(400);
  });

  it("keeps each user's settings separate", async () => {
    await put({ flowEditorSettings: { rfdVim: true } });
    signedInAs = "user-2";
    expect((await (await get()).json()).flowEditorSettings).toEqual({});
  });
});

describe("/api/settings flowAutoSave", () => {
  beforeEach(async () => {
    signedInAs = "user-1";
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values({ id: "user-1", name: "u", email: "u@example.com", createdAt: now, updatedAt: now });
  });

  it("defaults to saved, persists a mode, and rejects unknown values", async () => {
    expect((await (await get()).json()).flowAutoSave).toBe("saved");
    expect((await put({ flowAutoSave: "all" })).status).toBe(200);
    expect((await (await get()).json()).flowAutoSave).toBe("all");
    const bad = await put({ flowAutoSave: "sometimes" });
    expect(bad.status).toBe(400);
    expect((await (await get()).json()).flowAutoSave).toBe("all");
  });
});
