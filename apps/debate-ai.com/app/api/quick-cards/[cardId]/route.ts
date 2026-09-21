import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedQuickCards } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import {
  hasQuickCardSaveConflict,
  isValidQuickCardRecord,
  MAX_SAVED_QUICK_CARD_BYTES,
  type QuickCard,
} from "debate-editor/engine"
import { withRouteErrors } from "@/lib/api/route-errors"

/**
 * Account-linked Quick Cards sync — single-card CRUD, keyed by `cardId`
 * (the card's own id) within the current user's rows. Mirrors
 * `/api/coach-materials/[materialId]`'s account-only (401 without a
 * session) mode.
 *
 * PUT    { card: QuickCard } — validates (`isValidQuickCardRecord`) and
 *   upserts, keyed by `(userId, cardId)`; the route's `cardId` must match
 *   `card.id`. Rejects with 409 (see `hasQuickCardSaveConflict`) instead of
 *   overwriting when the currently-saved row's own `updatedAt` is already
 *   newer than the incoming card's — an edit race between two signed-in
 *   devices — returning the current card so the caller can adopt it.
 * DELETE — removes the synced card for this `cardId`.
 *
 * No GET here: `GET /api/quick-cards` already returns every record in
 * full (see that route's comment for why), so there's no need for a
 * single-card fetch.
 */

export const PUT = withRouteErrors(
  "PUT /api/quick-cards/[cardId]",
  async (req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) => {
    const { cardId } = await params

    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Sign in to sync quick cards to your account." }, { status: 401 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const card = (body as { card?: unknown } | null)?.card
    if (!isValidQuickCardRecord(card)) {
      return NextResponse.json({ error: "Request body's \"card\" is not a valid quick card." }, { status: 400 })
    }
    if (card.id !== cardId) {
      return NextResponse.json({ error: "The card's id must match the URL's card id." }, { status: 400 })
    }

    const data = JSON.stringify(card)
    if (data.length > MAX_SAVED_QUICK_CARD_BYTES) {
      return NextResponse.json({ error: "This quick card is too large to sync to your account." }, { status: 413 })
    }

    const db = await getDBFromContext()

    const [existing] = await db
      .select({ data: savedQuickCards.data })
      .from(savedQuickCards)
      .where(and(eq(savedQuickCards.userId, userId), eq(savedQuickCards.clientId, cardId)))
      .limit(1)

    if (existing) {
      const currentCard = JSON.parse(existing.data) as QuickCard
      if (hasQuickCardSaveConflict(currentCard, card)) {
        return NextResponse.json(
          {
            error: "This quick card was edited from another device since your last sync.",
            current: currentCard,
          },
          { status: 409 },
        )
      }
    }

    const now = new Date()

    await db
      .insert(savedQuickCards)
      .values({ userId, clientId: cardId, data, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [savedQuickCards.userId, savedQuickCards.clientId],
        set: { data, updatedAt: now },
      })

    return NextResponse.json({ cardId, updatedAt: now.toISOString() })
  },
)

export const DELETE = withRouteErrors(
  "DELETE /api/quick-cards/[cardId]",
  async (req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) => {
    const { cardId } = await params

    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Sign in to manage your synced quick cards." }, { status: 401 })
    }

    const db = await getDBFromContext()
    await db
      .delete(savedQuickCards)
      .where(and(eq(savedQuickCards.userId, userId), eq(savedQuickCards.clientId, cardId)))

    return NextResponse.json({ success: true })
  },
)
