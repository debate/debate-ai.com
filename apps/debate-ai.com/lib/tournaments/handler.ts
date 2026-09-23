/**
 * The tournaments API (packages/debate-tournaments — upstream Tabroom's public
 * `/rest` and `/pages` routes running on D1), wired to this app's database and
 * session. Mounted at `/api/tabroom` by `app/api/tabroom/[...path]/route.ts`.
 *
 * Tabroom's tables live in the app's own D1 database (`debate_db`, migrated by
 * `scripts/migrate-d1.ts` from the package's `migrations/`), unless a separate
 * `tabroom_db` binding is configured, which then takes precedence. In local
 * development the libSQL file database stands in for D1.
 */

import { createTournamentsHandler, d1FromLibsql, type D1DatabaseLike } from "debate-tournaments/server"
import { getCloudflareContext } from "@/lib/database/context"
import { sessionedD1 } from "@/lib/database/d1-session"
import { getSession } from "@/lib/auth/session"

declare const __USE_LIBSQL__: boolean

export const TABROOM_API_BASE = "/api/tabroom"

async function getTabroomD1(): Promise<D1DatabaseLike> {
  const env = getCloudflareContext()?.env
  const binding = (env?.tabroom_db ?? env?.debate_db) as D1Database | undefined
  if (binding) return sessionedD1(binding) as unknown as D1DatabaseLike

  if (typeof __USE_LIBSQL__ !== "undefined" && !__USE_LIBSQL__) {
    throw new Error("D1 database binding 'debate_db' not found in Cloudflare Workers context")
  }
  // Local development only; tree-shaken from the Workers build.
  const { getLibSQLDB } = await import("@/lib/database/libsql")
  const db = await getLibSQLDB()
  return d1FromLibsql(db.$client)
}

export const handleTabroomRequest = createTournamentsHandler({
  basePath: TABROOM_API_BASE,
  getDb: getTabroomD1,
  getUser: async () => {
    const session = await getSession()
    return session ? { email: session.user.email, name: session.user.name } : null
  },
})
