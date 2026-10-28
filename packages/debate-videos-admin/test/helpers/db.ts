/**
 * @fileoverview A fresh in-memory SQLite database with the app's full drizzle
 * schema, for exercising the admin API routes end to end against real tables
 * and constraints. The same approach as `src/lib/__tests__/delete-user.test.ts`.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from "drizzle-kit/api";
import { NextRequest } from "next/server";
import * as schema from "@/lib/database/schema";

let ddl: string[] | undefined;

export async function freshDb() {
  ddl ??= await generateSQLiteMigration(
    await generateSQLiteDrizzleJson({}),
    await generateSQLiteDrizzleJson(schema),
  );
  const client = createClient({ url: ":memory:" });
  for (const statement of ddl) await client.execute(statement);
  return drizzle(client, { schema });
}

export type DB = Awaited<ReturnType<typeof freshDb>>;

/** A route request; a non-string `body` is sent as JSON. */
export function request(path: string, init: { method?: string; body?: unknown } = {}) {
  const { method = "GET", body } = init;
  return new NextRequest(`http://localhost${path}`, {
    method,
    ...(body === undefined
      ? {}
      : {
          body: typeof body === "string" ? body : JSON.stringify(body),
          headers: { "content-type": "application/json" },
        }),
  });
}

/** The `{ params }` context App Router passes a dynamic route. */
export const params = <T extends Record<string, string>>(value: T) => ({ params: Promise.resolve(value) });
