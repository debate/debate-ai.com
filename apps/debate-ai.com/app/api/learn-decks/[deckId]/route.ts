import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedLearnDecks } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { isValidLearnDeckRecord, MAX_SAVED_LEARN_DECK_BYTES } from "debate-editor/engine"
import { withRouteErrors } from "@/lib/api/route-errors"

/**
 * Account-linked Learn custom-deck sync — single-deck CRUD, keyed by
 * `deckId` (the deck's own id) within the current user's rows. Mirrors
 * `/api/learn-cards/[cardId]`'s account-only (401 without a session) mode.
 *
 * PUT    { deck: CustomDeck } — validates (`isValidLearnDeckRecord`) and
 *   upserts, keyed by `(userId, deckId)`; the route's `deckId` must match
 *   `deck.deckId`.
 * DELETE — removes the synced deck for this `deckId`.
 *
 * No GET here: `GET /api/learn-decks` already returns every record in
 * full (see that route's comment for why), so there's no need for a
 * single-deck fetch.
 */

export const PUT = withRouteErrors(
  "PUT /api/learn-decks/[deckId]",
  async (req: NextRequest, { params }: { params: Promise<{ deckId: string }> }) => {
    const { deckId } = await params

    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Sign in to sync decks to your account." }, { status: 401 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const deck = (body as { deck?: unknown } | null)?.deck
    if (!isValidLearnDeckRecord(deck)) {
      return NextResponse.json({ error: "Request body's \"deck\" is not a valid deck." }, { status: 400 })
    }
    if (deck.deckId !== deckId) {
      return NextResponse.json({ error: "The deck's id must match the URL's deck id." }, { status: 400 })
    }

    const data = JSON.stringify(deck)
    if (data.length > MAX_SAVED_LEARN_DECK_BYTES) {
      return NextResponse.json({ error: "This deck is too large to sync to your account." }, { status: 413 })
    }

    const db = await getDBFromContext()
    const now = new Date()

    await db
      .insert(savedLearnDecks)
      .values({ userId, clientId: deckId, data, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [savedLearnDecks.userId, savedLearnDecks.clientId],
        set: { data, updatedAt: now },
      })

    return NextResponse.json({ deckId, updatedAt: now.toISOString() })
  },
)

export const DELETE = withRouteErrors(
  "DELETE /api/learn-decks/[deckId]",
  async (req: NextRequest, { params }: { params: Promise<{ deckId: string }> }) => {
    const { deckId } = await params

    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Sign in to manage your synced decks." }, { status: 401 })
    }

    const db = await getDBFromContext()
    await db
      .delete(savedLearnDecks)
      .where(and(eq(savedLearnDecks.userId, userId), eq(savedLearnDecks.clientId, deckId)))

    return NextResponse.json({ success: true })
  },
)
