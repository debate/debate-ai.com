import { NextRequest, NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedCoachMaterials } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { withRouteErrors } from "@/lib/api/route-errors"

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
 *   (`CoachMaterial[]`, each with the row's own `updatedAt` mixed in — see
 *   below). A material's payload (a transcript or document's text) can be
 *   sizable, but still small enough that `useCoachMaterialsSync`'s merge and
 *   `CoachMaterialsPanel`'s library view can both use this one call directly
 *   without a per-material follow-up fetch.
 *
 *   `CoachMaterial` itself carries no `updatedAt`/`createdAt` of its own
 *   (`reviewedAt` only covers a review decision, not a save) — a genuine
 *   omission this discovered rather than a deliberate exclusion, since the
 *   PUT route below already tracks and returns this row's own `updatedAt` on
 *   every upsert. Mixing that same column into each listed row (as
 *   `SyncedCoachMaterial` in `coach-materials-client.ts`) is what lets Coach
 *   Materials join `debate-round`'s `cloudLibrary.ts` merge — see that
 *   module's own "joined next" history — without inventing a display
 *   timestamp `CoachMaterialsPanel` doesn't otherwise need.
 */

export const GET = withRouteErrors(
  "GET /api/coach-materials",
  async (req: NextRequest) => {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Sign in to view your synced coach materials." }, { status: 401 })
    }

    const db = await getDBFromContext()
    const rows = await db
      .select({ data: savedCoachMaterials.data, updatedAt: savedCoachMaterials.updatedAt })
      .from(savedCoachMaterials)
      .where(eq(savedCoachMaterials.userId, userId))
      .orderBy(asc(savedCoachMaterials.createdAt))

    return NextResponse.json(
      rows.map((row: { data: string; updatedAt: Date }) => ({
        ...JSON.parse(row.data),
        updatedAt: row.updatedAt.toISOString(),
      })),
    )
  },
)
