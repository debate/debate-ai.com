import { drizzle } from "drizzle-orm/d1";
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
 * The D1 driver is a static import because this is the only production
 * database path. Loading it through `await import()` deferred a small chunk
 * until after auth had already run, and workerd can fail that request-time
 * import with "Dynamic import exceeded memory limits." when the isolate is
 * under memory pressure. The libSQL fallback stays dynamic: it is local-only
 * and is dead code in the Workers build (`__USE_LIBSQL__` is false).
 *
 * @param d1 - Optional D1Database binding from Cloudflare Workers
 * @returns Drizzle database instance
 */
export async function getDB(d1?: D1Database) {
  // If D1 is explicitly passed, use it
  if (d1) {
    return drizzle(sessionedD1(d1), { schema });
  }

  // Try to get D1 from Cloudflare context (Workers environment)
  const context = getCloudflareContext();
  if (context?.env?.debate_db) {
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
