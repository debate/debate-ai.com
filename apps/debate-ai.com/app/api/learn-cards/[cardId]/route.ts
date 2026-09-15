import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedLearnCards } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { isValidLearnCardRecord, MAX_SAVED_LEARN_CARD_BYTES } from "debate-editor/engine"
import { withRouteErrors } from "@/lib/api/route-errors"

/**
 * Account-linked Learn flashcard-content sync — single-card CRUD, keyed by
 * `cardId` (the card's own id) within the current user's rows. Mirrors
 * `/api/quick-cards/[cardId]`'s account-only (401 without a session) mode.
 *
 * PUT    { card: CardDef } — validates (`isValidLearnCardRecord`) and
 *   upserts, keyed by `(userId, cardId)`; the route's `cardId` must match
 *   `card.id`.
 * DELETE — removes the synced card for this `cardId`.
 *
 * No GET here: `GET /api/learn-cards` already returns every record in
 * full (see that route's comment for why), so there's no need for a
 * single-card fetch.
 */

export const PUT = withRouteErrors(
  "PUT /api/learn-cards/[cardId]",
  async (req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) => {
    const { cardId } = await params

    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Sign in to sync flashcards to your account." }, { status: 401 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const card = (body as { card?: unknown } | null)?.card
    if (!isValidLearnCardRecord(card)) {
      return NextResponse.json({ error: "Request body's \"card\" is not a valid flashcard." }, { status: 400 })
    }
    if (card.id !== cardId) {
      return NextResponse.json({ error: "The card's id must match the URL's card id." }, { status: 400 })
    }

    const data = JSON.stringify(card)
    if (data.length > MAX_SAVED_LEARN_CARD_BYTES) {
      return NextResponse.json({ error: "This flashcard is too large to sync to your account." }, { status: 413 })
    }

    const db = await getDBFromContext()
    const now = new Date()

    await db
      .insert(savedLearnCards)
      .values({ userId, clientId: cardId, data, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [savedLearnCards.userId, savedLearnCards.clientId],
        set: { data, updatedAt: now },
      })

    return NextResponse.json({ cardId, updatedAt: now.toISOString() })
  },
)

export const DELETE = withRouteErrors(
  "DELETE /api/learn-cards/[cardId]",
  async (req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) => {
    const { cardId } = await params

    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Sign in to manage your synced flashcards." }, { status: 401 })
    }

    const db = await getDBFromContext()
    await db
      .delete(savedLearnCards)
      .where(and(eq(savedLearnCards.userId, userId), eq(savedLearnCards.clientId, cardId)))

    return NextResponse.json({ success: true })
  },
)
