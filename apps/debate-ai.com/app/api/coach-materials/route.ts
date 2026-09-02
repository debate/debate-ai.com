import { NextRequest, NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedCoachMaterials } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"

/**
 * Account-linked coach-material sync — TODO.md idea #8
 * ("Video-Lecture-Training Coach AI"), "Account sync for coach materials
 * (and their version history)" follow-up. One `saved_coach_materials` row
 * per (user, material) pair, keyed by the caller-typed `CoachMaterial.id`.
 * Same account-only shape as `/api/round-pairings` — no anonymous/signed-out
 * mode, 401 without a session — since a synced material only exists once
 * explicitly saved.
 *
 * GET — every one of the current user's synced coach materials, in full
 *   (`CoachMaterial[]`). A material's payload (a transcript or document's
 *   text) can be sizable, but still small enough that
 *   `useCoachMaterialsSync`'s merge and `CoachMaterialsPanel`'s library view
 *   can both use this one call directly without a per-material follow-up
 *   fetch.
 */

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to view your synced coach materials." }, { status: 401 })
  }

  const db = await getDBFromContext()
  const rows = await db
    .select({ data: savedCoachMaterials.data })
    .from(savedCoachMaterials)
    .where(eq(savedCoachMaterials.userId, userId))
    .orderBy(asc(savedCoachMaterials.createdAt))

  return NextResponse.json(rows.map((row: { data: string }) => JSON.parse(row.data)))
}
