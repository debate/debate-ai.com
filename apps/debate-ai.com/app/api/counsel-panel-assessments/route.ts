import { NextRequest, NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedCounselPanelAssessments } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"

/**
 * Account-linked counsel-panel-assessment-history sync — TODO.md idea #4
 * ("AI Response-Outcome Charts"), "a timeline of past AI counsel-panel
 * assessments for a round, not just the latest" follow-up. One
 * `saved_counsel_panel_assessments` row per generated assessment (many rows
 * can share a `roundId`), keyed by the caller-generated
 * `CounselPanelAssessmentRecord.id`. Same account-only shape as
 * `/api/judge-decisions` — no anonymous/signed-out mode, 401 without a
 * session — since a synced assessment only exists once explicitly
 * generated.
 *
 * GET — every one of the current user's synced counsel-panel assessments,
 *   in full (`CounselPanelAssessmentRecord[]`), across every round. Like
 *   `/api/judge-decisions`, this returns full records rather than
 *   label-only summaries — an assessment's payload is small enough that
 *   `useCounselPanelAssessments`'s merge and `VulnerabilityChartsPanel`'s
 *   history log can both use this one call directly without a
 *   per-assessment follow-up fetch.
 */

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to view your synced counsel-panel assessments." }, { status: 401 })
  }

  const db = await getDBFromContext()
  const rows = await db
    .select({ data: savedCounselPanelAssessments.data })
    .from(savedCounselPanelAssessments)
    .where(eq(savedCounselPanelAssessments.userId, userId))
    .orderBy(asc(savedCounselPanelAssessments.createdAt))

  return NextResponse.json(rows.map((row: { data: string }) => JSON.parse(row.data)))
}
