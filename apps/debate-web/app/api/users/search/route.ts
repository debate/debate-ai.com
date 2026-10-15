import { NextRequest, NextResponse } from "next/server"
import { and, like, ne, or } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { user } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"

/**
 * Registered-user lookup backing the Create New Round dialog's debater/
 * judge/spectator autocomplete — link a registered account instead of
 * always falling back to a bare email invite (see TODO.md's "Create New
 * Round — registered-user autocomplete + invite notifications" Completed
 * entry). Requires a session, both to keep the directory from being
 * scraped anonymously and because only a signed-in user is ever composing
 * an invite. Matches on a case-insensitive substring of name or email and
 * never returns the caller themselves (inviting yourself is a no-op the
 * client already filters, but excluding it here keeps the API's own
 * contract honest).
 *
 * GET ?q=<query> — up to `RESULT_LIMIT` `{ id, name, email, image }` rows.
 * An empty/whitespace-only `q` returns no results rather than an
 * unfiltered directory dump.
 */

const RESULT_LIMIT = 8

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to search for registered users." }, { status: 401 })
  }

  const query = (req.nextUrl.searchParams.get("q") ?? "").trim()
  if (!query) {
    return NextResponse.json({ users: [] })
  }

  const db = await getDBFromContext()
  // Not escaped for literal `%`/`_` — a query containing one just matches a
  // little more loosely (SQLite's `LIKE` treats them as wildcards), which is
  // an acceptable tradeoff for an autocomplete field; it's parameterized
  // either way, so there's no injection risk.
  const pattern = `%${query}%`
  const rows = await db
    .select({ id: user.id, name: user.name, email: user.email, image: user.image })
    .from(user)
    .where(and(ne(user.id, userId), or(like(user.name, pattern), like(user.email, pattern))))
    .limit(RESULT_LIMIT)

  return NextResponse.json({ users: rows })
}
