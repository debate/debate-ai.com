import { NextResponse } from "next/server"
import { desc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { reuseCheckLog } from "@/lib/database/schema"
import { buildReuseCheckDashboard, type ReuseCheckLogRecord } from "debate-research-evidence"

/**
 * Idea #7's ("On Page Card Reuse Search") "team dashboard of pages flagged
 * as already-cut, so a coach can see reuse patterns at a glance" follow-up.
 * Reads the `reuseCheckLog` rows every `GET /api/evidence-reuse-check` call
 * appends (see that route) and folds them, via the pure
 * `buildReuseCheckDashboard`, into one ranked row per page — most
 * frequently flagged already-cut first.
 *
 * GET — no params; returns the whole team's dashboard (capped at
 *   `DASHBOARD_LIMIT` rows).
 */

// Caps how many of the most recent flagged-already-cut log rows feed the
// dashboard, so a long-lived team's log can't make this scan unbounded.
const MAX_LOG_ROWS_SCANNED = 2000
const DASHBOARD_LIMIT = 25

export async function GET() {
  const db = await getDBFromContext()
  const rows = await db
    .select()
    .from(reuseCheckLog)
    .where(eq(reuseCheckLog.alreadyCut, true))
    .orderBy(desc(reuseCheckLog.checkedAt))
    .limit(MAX_LOG_ROWS_SCANNED)

  const records: ReuseCheckLogRecord[] = rows.map((row) => ({
    url: row.url,
    normalizedUrl: row.normalizedUrl,
    alreadyCut: row.alreadyCut,
    matchCount: row.matchCount,
    source: row.source === "extension" ? "extension" : "web",
    checkedAt: row.checkedAt,
  }))

  const dashboard = buildReuseCheckDashboard(records, DASHBOARD_LIMIT)
  return NextResponse.json({ dashboard })
}
