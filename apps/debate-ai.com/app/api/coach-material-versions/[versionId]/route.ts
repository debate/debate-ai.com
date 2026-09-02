import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedCoachMaterialVersions } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { isValidCoachMaterialVersionRecord, MAX_SAVED_COACH_MATERIAL_VERSION_BYTES } from "debate-speech-writer"

/**
 * Account-linked coach-material version-history sync — the same TODO.md
 * idea #8 follow-up as `/api/coach-materials/[materialId]`. Single-version
 * CRUD, keyed by `versionId` (the version's own generated `id`, not its
 * `materialId` — many versions can share a material) within the current
 * user's rows — mirrors `/api/judge-decisions/[decisionId]`'s account-only
 * (401 without a session) mode.
 *
 * PUT    { record: CoachMaterialVersion } — validates
 *   (`isValidCoachMaterialVersionRecord`) and upserts, keyed by
 *   `(userId, versionId)`; the route's `versionId` must match `record.id`.
 * DELETE — removes the synced version for this `versionId`.
 *
 * No GET here: `GET /api/coach-material-versions` already returns every
 * record in full (see that route's comment for why), so there's no need for
 * a single-version fetch.
 */

export async function PUT(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to sync coach-material version history to your account." },
      { status: 401 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const record = (body as { record?: unknown } | null)?.record
  if (!isValidCoachMaterialVersionRecord(record)) {
    return NextResponse.json(
      { error: "Request body's \"record\" is not a valid coach-material version." },
      { status: 400 },
    )
  }
  if (record.id !== versionId) {
    return NextResponse.json({ error: "The record's id must match the URL's version id." }, { status: 400 })
  }

  const data = JSON.stringify(record)
  if (data.length > MAX_SAVED_COACH_MATERIAL_VERSION_BYTES) {
    return NextResponse.json({ error: "This version is too large to sync to your account." }, { status: 413 })
  }

  const db = await getDBFromContext()
  const now = new Date()

  await db
    .insert(savedCoachMaterialVersions)
    .values({ userId, clientId: versionId, materialId: record.materialId, data, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [savedCoachMaterialVersions.userId, savedCoachMaterialVersions.clientId],
      set: { data, updatedAt: now },
    })

  return NextResponse.json({ versionId, updatedAt: now.toISOString() })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to manage your synced coach-material version history." },
      { status: 401 },
    )
  }

  const db = await getDBFromContext()
  await db
    .delete(savedCoachMaterialVersions)
    .where(and(eq(savedCoachMaterialVersions.userId, userId), eq(savedCoachMaterialVersions.clientId, versionId)))

  return NextResponse.json({ success: true })
}
