import * as schema from "./schema";
import { getCloudflareContext } from "./context";
import { sessionedD1 } from "./d1-session";

declare const __USE_LIBSQL__: boolean;

/**
 * Get database instance - supports both Cloudflare D1 and local libSQL
 *
 * The D1 binding is routed through `sessionedD1()` so that, with read
 * replication enabled, every query in a request shares one D1 session and
 * therefore one sequentially consistent view of the database — see
 * ./d1-session.ts. Outside a session scope it is a pass-through.
 *
 * @param d1 - Optional D1Database binding from Cloudflare Workers
 * @returns Drizzle database instance
 */
export async function getDB(d1?: D1Database) {
  // If D1 is explicitly passed, use it
  if (d1) {
    const { drizzle } = await import("drizzle-orm/d1");
    return drizzle(sessionedD1(d1), { schema });
  }

  // Try to get D1 from Cloudflare context (Workers environment)
  const context = getCloudflareContext();
  if (context?.env?.debate_db) {
    const { drizzle } = await import("drizzle-orm/d1");
    return drizzle(sessionedD1(context.env.debate_db), { schema });
  }

  // Fall back to libSQL for local development only
  // __USE_LIBSQL__ is false in production Workers build
  if (typeof __USE_LIBSQL__ !== "undefined" && !__USE_LIBSQL__) {
    throw new Error("D1 database binding 'debate_db' not found in Cloudflare Workers context");
  }

  // This code path is dead code in Workers and will be tree-shaken
  const { getLibSQLDB } = await import("./libsql");
  return getLibSQLDB();
}
