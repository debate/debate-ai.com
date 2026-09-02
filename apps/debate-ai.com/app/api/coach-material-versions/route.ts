import { NextRequest, NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedCoachMaterialVersions } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"

/**
 * Account-linked coach-material version-history sync — the same TODO.md
 * idea #8 follow-up as `/api/coach-materials`, applied to
 * `state/coachMaterialVersions.ts`'s snapshots. One row per generated
 * version (many rows can share a `materialId`), keyed by the caller-generated
 * `CoachMaterialVersion.id`. Same account-only shape as `/api/judge-decisions`
 * — no anonymous/signed-out mode, 401 without a session.
 *
 * GET — every one of the current user's synced version snapshots, in full
 *   (`CoachMaterialVersion[]`), across every material — mirrors
 *   `/api/judge-decisions`'s "return full records, not just labels" shape.
 */

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to view your synced coach-material version history." },
      { status: 401 },
    )
  }

  const db = await getDBFromContext()
  const rows = await db
    .select({ data: savedCoachMaterialVersions.data })
    .from(savedCoachMaterialVersions)
    .where(eq(savedCoachMaterialVersions.userId, userId))
    .orderBy(asc(savedCoachMaterialVersions.createdAt))

  return NextResponse.json(rows.map((row: { data: string }) => JSON.parse(row.data)))
}
