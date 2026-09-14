import { NextResponse } from "next/server"
import { createPracticeVsAiBackend, type DebateActor } from "debate-practice-vs-ai"
import { getSession } from "@/lib/auth/session"
import { createPracticeVsAiStore } from "@/lib/practice-vs-ai/store"

/**
 * GET /api/vsbot/history — the signed-in user's past Practice vs AI debates,
 * newest first, full transcript included (a round's history is small enough
 * that a second "get one" route to defer it isn't worth the extra request).
 *
 * Not a Go-ported route — added so a returning user can browse rounds that
 * were already being saved to `practice_vs_ai_debates` with nowhere to view
 * them. Goes through `createPracticeVsAiBackend`'s `listDebates` (with
 * `model: null`, since listing never calls the model) rather than the store
 * directly, so the same handler is covered by
 * `packages/debate-round-practice-ai/test/handlers.test.ts` against the
 * in-memory store.
 */
export async function GET() {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to view your debate history." }, { status: 401 })
  }

  const actor: DebateActor = { userId: session.user.id, email: session.user.email ?? "" }
  const backend = createPracticeVsAiBackend({ store: createPracticeVsAiStore(session.user.id), model: null })
  const result = await backend.listDebates(actor)
  return NextResponse.json(result.body, { status: result.status })
}
