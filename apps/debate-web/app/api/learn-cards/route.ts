import { NextRequest, NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedLearnCards } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { withRouteErrors } from "@/lib/api/route-errors"

/**
 * Account-linked Learn flashcard-content sync — closes the standing
 * "Learn's flashcard library never leaves this device" gap TODO.md has
 * flagged across several runs. Mirrors `/api/quick-cards`'s shape exactly:
 * one `saved_learn_cards` row per (user, card) pair, keyed by the card's
 * own `id` (`packages/debate-editor/src/editor/learn-store.ts`'s
 * `CardDef`). Only card CONTENT syncs here — no schedule, anchor, AI
 * thread, note, review log, deck, or doc registry (see
 * `learn-cards-sync.ts`'s module doc for why). Account-only — no
 * anonymous/signed-out mode, 401 without a session — since a synced card
 * only exists once explicitly merged/pushed.
 *
 * GET — every one of the current user's synced flashcards, in full
 *   (`CardDef[]`), for `learn-cards-sync.ts`'s merge-on-init.
 */

export const GET = withRouteErrors(
  "GET /api/learn-cards",
  async (req: NextRequest) => {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Sign in to view your synced flashcards." }, { status: 401 })
    }

    const db = await getDBFromContext()
    const rows = await db
      .select({ data: savedLearnCards.data })
      .from(savedLearnCards)
      .where(eq(savedLearnCards.userId, userId))
      .orderBy(asc(savedLearnCards.createdAt))

    return NextResponse.json(rows.map((row: { data: string }) => JSON.parse(row.data)))
  },
)
