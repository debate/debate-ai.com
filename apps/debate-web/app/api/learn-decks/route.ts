import { NextRequest, NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedLearnDecks } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { withRouteErrors } from "@/lib/api/route-errors"

/**
 * Account-linked Learn custom-deck sync — closes the next slice of the
 * standing "Learn's flashcard library never leaves this device" gap
 * TODO.md has flagged across several runs, mirroring `/api/learn-cards`'s
 * shape exactly: one `saved_learn_decks` row per (user, deck) pair, keyed
 * by the deck's own `deckId` (`packages/debate-editor/src/editor/learn-store.ts`'s
 * `CustomDeck`). Account-only — no anonymous/signed-out mode, 401 without
 * a session — since a synced deck only exists once explicitly
 * merged/pushed.
 *
 * GET — every one of the current user's synced decks, in full
 *   (`CustomDeck[]`), for `learn-decks-sync.ts`'s merge-on-init.
 */

export const GET = withRouteErrors(
  "GET /api/learn-decks",
  async (req: NextRequest) => {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Sign in to view your synced decks." }, { status: 401 })
    }

    const db = await getDBFromContext()
    const rows = await db
      .select({ data: savedLearnDecks.data })
      .from(savedLearnDecks)
      .where(eq(savedLearnDecks.userId, userId))
      .orderBy(asc(savedLearnDecks.createdAt))

    return NextResponse.json(rows.map((row: { data: string }) => JSON.parse(row.data)))
  },
)
