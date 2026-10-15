import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { debateCards } from "@/lib/database/schema"
import { getSession } from "@/lib/auth/session"
import { annotateCard, annotationCardHash, readSavedAnnotations } from "@/lib/evidence-reuse-check/card-annotation"

/**
 * LLM annotation — flaws an opponent would attack and how qualified the
 * author is — for a corpus card the on-page reuse check matched
 * (`GET /api/evidence-reuse-check` returns `card.cardId` on those matches).
 *
 * POST { cardId } → `{ cardId, annotation, cached }`.
 *
 * Takes a card id rather than card text, so the model only ever sees cards
 * that are in the library. A saved annotation is served to anyone; generating
 * a new one costs a model call, so it needs a session (the browser extension
 * sends its bearer token). Each card is generated once and then shared.
 */

const error = (message: string, status: number) => NextResponse.json({ error: message }, { status })

export async function POST(req: NextRequest) {
  let body: { cardId?: unknown }
  try {
    body = await req.json()
  } catch {
    return error("Invalid JSON body.", 400)
  }
  const cardId = Number(body.cardId)
  if (!Number.isSafeInteger(cardId) || cardId <= 0) return error("`cardId` must be a positive integer.", 400)

  const db = await getDBFromContext()
  const [card] = await db
    .select({
      tag: debateCards.tag,
      cite: debateCards.cite,
      fullcite: debateCards.fullcite,
      markup: debateCards.markup,
      spoken: debateCards.spoken,
      fulltext: debateCards.fulltext,
    })
    .from(debateCards)
    .where(eq(debateCards.id, cardId))
    .limit(1)
  if (!card) return error("No card with that id.", 404)

  const cardHash = await annotationCardHash(card)
  const saved = (await readSavedAnnotations(db, [cardHash])).get(cardHash)
  if (saved) return NextResponse.json({ cardId, annotation: saved, cached: true })

  const session = await getSession()
  if (!session) return error("Sign in to annotate a card that has not been annotated yet.", 401)

  const result = await annotateCard(db, card, session.user.id)
  if (!result.ok) return error(result.error, result.status)
  return NextResponse.json({ cardId, annotation: result.annotation, cached: result.cached })
}
