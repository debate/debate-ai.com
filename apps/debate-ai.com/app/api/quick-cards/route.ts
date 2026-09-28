import { NextRequest, NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedQuickCards } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { withRouteErrors } from "@/lib/api/route-errors"

/**
 * Account-linked Quick Cards library sync — closes the same standing "docs"
 * gap `/api/speech-send-log` closed for CardMirror's speech-send history:
 * the Quick Cards reusable-snippet library
 * (`packages/debate-editor/src/editor/quick-cards-store.ts`, IndexedDB on
 * web) was device-local only. One `saved_quick_cards` row per (user, card)
 * pair, keyed by the caller-typed `QuickCard.id`. Account-only — no
 * anonymous/signed-out mode, 401 without a session — since a synced card
 * only exists once explicitly saved.
 *
 * GET — every one of the current user's synced quick cards, in full
 *   (`QuickCard[]`). A card's payload (a serialized ProseMirror slice) can
 *   be sizable, but `quickCardsStore`'s merge-on-init still uses this one
 *   call directly without a per-card follow-up fetch, mirroring
 *   `/api/coach-materials`'s and `/api/speech-send-log`'s same shape.
 *
 * DELETE — removes every one of the current user's synced quick cards in
 *   one call, mirroring `/api/tool-records/[collection]`'s bulk-clear route;
 *   single-card deletes still go through `[cardId]/route.ts`.
 */

export const GET = withRouteErrors(
  "GET /api/quick-cards",
  async (req: NextRequest) => {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Sign in to view your synced quick cards." }, { status: 401 })
    }

    const db = await getDBFromContext()
    const rows = await db
      .select({ data: savedQuickCards.data })
      .from(savedQuickCards)
      .where(eq(savedQuickCards.userId, userId))
      .orderBy(asc(savedQuickCards.createdAt))

    return NextResponse.json(rows.map((row: { data: string }) => JSON.parse(row.data)))
  },
)

export const DELETE = withRouteErrors(
  "DELETE /api/quick-cards",
  async (req: NextRequest) => {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Sign in to manage your synced quick cards." }, { status: 401 })
    }

    const db = await getDBFromContext()
    await db.delete(savedQuickCards).where(eq(savedQuickCards.userId, userId))

    return NextResponse.json({ success: true })
  },
)
