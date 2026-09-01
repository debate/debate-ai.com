import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedCounselPanelAssessments } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { isValidCounselPanelAssessmentRecord, MAX_SAVED_COUNSEL_PANEL_ASSESSMENT_BYTES } from "debate-round"

/**
 * Account-linked counsel-panel-assessment-history sync — TODO.md idea #4's
 * "a timeline of past AI counsel-panel assessments for a round, not just
 * the latest" follow-up. Single-assessment CRUD, keyed by `assessmentId`
 * (the assessment's own generated `id`, not its `roundId` — many
 * assessments can share a round) within the current user's rows — mirrors
 * `/api/judge-decisions/[decisionId]`'s account-only (401 without a
 * session) mode.
 *
 * PUT    { record: CounselPanelAssessmentRecord } — validates
 *   (`isValidCounselPanelAssessmentRecord`) and upserts, keyed by
 *   `(userId, assessmentId)`; the route's `assessmentId` must match
 *   `record.id`.
 * DELETE — removes the synced assessment for this `assessmentId`.
 *
 * No GET here: `GET /api/counsel-panel-assessments` already returns every
 * record in full (see that route's comment for why), so there's no need
 * for a single-assessment fetch.
 */

export async function PUT(req: NextRequest, { params }: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to sync counsel-panel assessments to your account." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const record = (body as { record?: unknown } | null)?.record
  if (!isValidCounselPanelAssessmentRecord(record)) {
    return NextResponse.json(
      { error: "Request body's \"record\" is not a valid counsel-panel assessment." },
      { status: 400 },
    )
  }
  if (record.id !== assessmentId) {
    return NextResponse.json({ error: "The record's id must match the URL's assessment id." }, { status: 400 })
  }

  const data = JSON.stringify(record)
  if (data.length > MAX_SAVED_COUNSEL_PANEL_ASSESSMENT_BYTES) {
    return NextResponse.json({ error: "This counsel-panel assessment is too large to sync to your account." }, { status: 413 })
  }

  const db = await getDBFromContext()
  const now = new Date()

  await db
    .insert(savedCounselPanelAssessments)
    .values({ userId, clientId: assessmentId, roundId: record.roundId, data, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [savedCounselPanelAssessments.userId, savedCounselPanelAssessments.clientId],
      set: { data, updatedAt: now },
    })

  return NextResponse.json({ assessmentId, updatedAt: now.toISOString() })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to manage your synced counsel-panel assessments." }, { status: 401 })
  }

  const db = await getDBFromContext()
  await db
    .delete(savedCounselPanelAssessments)
    .where(and(eq(savedCounselPanelAssessments.userId, userId), eq(savedCounselPanelAssessments.clientId, assessmentId)))

  return NextResponse.json({ success: true })
}
