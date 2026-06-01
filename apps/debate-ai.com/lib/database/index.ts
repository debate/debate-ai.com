import * as schema from "./schema";

let db: any = null;

export async function getDB(d1?: D1Database) {
  if (d1) {
    const { drizzle } = await import("drizzle-orm/d1");
    return drizzle(d1, { schema });
  }
  if (!db) {
    const { drizzle } = await import("drizzle-orm/libsql");
    const { createClient } = await import("@libsql/client");
    const client = createClient({
      url: process.env.DATABASE_URL || "file:./data/db.sqlite",
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    db = drizzle(client, { schema });
  }
  return db;
}
