import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedCoachMaterials, savedCoachMaterialVersions } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { isValidCoachMaterialRecord, MAX_SAVED_COACH_MATERIAL_BYTES } from "debate-speech-writer"

/**
 * Account-linked coach-material sync — TODO.md idea #8's "Account sync for
 * coach materials (and their version history)" follow-up. Single-material
 * CRUD, keyed by `materialId` (the material's own id) within the current
 * user's rows — mirrors `/api/round-pairings/[pairingId]`'s account-only
 * (401 without a session) mode.
 *
 * PUT    { record: CoachMaterial } — validates (`isValidCoachMaterialRecord`)
 *   and upserts, keyed by `(userId, materialId)`; the route's `materialId`
 *   must match `record.id`.
 * DELETE — removes the synced material for this `materialId`, and cascades
 *   to every synced version snapshot of it too — mirroring
 *   `state/coachMaterials.ts#deleteCoachMaterial`'s local cascade, since a
 *   left-behind version's `materialId` would otherwise point at nothing.
 *
 * No GET here: `GET /api/coach-materials` already returns every record in
 * full (see that route's comment for why), so there's no need for a
 * single-material fetch.
 */

export async function PUT(req: NextRequest, { params }: { params: Promise<{ materialId: string }> }) {
  const { materialId } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to sync coach materials to your account." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const record = (body as { record?: unknown } | null)?.record
  if (!isValidCoachMaterialRecord(record)) {
    return NextResponse.json({ error: "Request body's \"record\" is not a valid coach material." }, { status: 400 })
  }
  if (record.id !== materialId) {
    return NextResponse.json({ error: "The record's id must match the URL's material id." }, { status: 400 })
  }

  const data = JSON.stringify(record)
  if (data.length > MAX_SAVED_COACH_MATERIAL_BYTES) {
    return NextResponse.json({ error: "This material is too large to sync to your account." }, { status: 413 })
  }

  const db = await getDBFromContext()
  const now = new Date()

  await db
    .insert(savedCoachMaterials)
    .values({ userId, clientId: materialId, data, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [savedCoachMaterials.userId, savedCoachMaterials.clientId],
      set: { data, updatedAt: now },
    })

  return NextResponse.json({ materialId, updatedAt: now.toISOString() })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ materialId: string }> }) {
  const { materialId } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to manage your synced coach materials." }, { status: 401 })
  }

  const db = await getDBFromContext()
  await db
    .delete(savedCoachMaterials)
    .where(and(eq(savedCoachMaterials.userId, userId), eq(savedCoachMaterials.clientId, materialId)))
  await db
    .delete(savedCoachMaterialVersions)
    .where(and(eq(savedCoachMaterialVersions.userId, userId), eq(savedCoachMaterialVersions.materialId, materialId)))

  return NextResponse.json({ success: true })
}
