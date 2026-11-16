/**
 * Usernames for personal file addresses, against a real in-memory SQLite
 * database, plus the guard that keeps every top-level page out of them.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it } from "vitest";
import { RESERVED_USERNAMES } from "@debate-ai/reason-docs/lib/reason-docs/personal-doc-paths";
import * as schema from "../../database/schema";
import { getOrCreateUserHandle } from "../user-handles";

const db = drizzle(createClient({ url: ":memory:" }), { schema }) as unknown as Parameters<
  typeof getOrCreateUserHandle
>[0];

describe("getOrCreateUserHandle", () => {
  it("makes the handle from the name and keeps it", async () => {
    expect(await getOrCreateUserHandle(db, { id: "u1", name: "Alex Gul", email: "a@x.com" })).toBe("alexgul");
    expect(await getOrCreateUserHandle(db, { id: "u1", name: "Someone Else" })).toBe("alexgul");
  });

  it("numbers a name that is already taken", async () => {
    expect(await getOrCreateUserHandle(db, { id: "u2", name: "alex gul" })).toBe("alexgul2");
    expect(await getOrCreateUserHandle(db, { id: "u3", name: "Alex-Gul" })).toBe("alexgul3");
  });

  it("numbers a name that is a page route", async () => {
    expect(await getOrCreateUserHandle(db, { id: "u4", name: "Admin" })).toBe("admin2");
  });

  it("falls back to the email when the name has no letters or digits", async () => {
    expect(await getOrCreateUserHandle(db, { id: "u5", name: "—", email: "debater.one@x.com" })).toBe("debaterone");
  });
});

describe("RESERVED_USERNAMES", () => {
  it("holds every top-level route, so no username can shadow a page", () => {
    const appDir = join(__dirname, "../../../app");
    const routes = readdirSync(appDir).filter(
      (name) => statSync(join(appDir, name)).isDirectory() && !name.startsWith("[") && !name.startsWith("(") && !name.startsWith("_"),
    );
    expect(routes.length).toBeGreaterThan(10);
    for (const route of routes) expect(RESERVED_USERNAMES.has(route), route).toBe(true);
  });
});
