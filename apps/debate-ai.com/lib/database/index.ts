import * as schema from "./schema";

let db: any = null;

/**
 * Get database instance - supports both Cloudflare D1 and local libSQL
 * @param d1 - Optional D1Database binding from Cloudflare Workers
 * @returns Drizzle database instance
 */
export async function getDB(d1?: D1Database) {
  // Use D1 in Cloudflare Workers environment
  if (d1) {
    const { drizzle } = await import("drizzle-orm/d1");
    return drizzle(d1, { schema });
  }

  // Use libSQL for local development
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
