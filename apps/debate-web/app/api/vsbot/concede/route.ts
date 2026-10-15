import { withVsBotBackend } from "@/lib/practice-vs-ai/backend"

/**
 * POST /api/vsbot/concede — concede the round; counts as a loss.
 *
 * The Next.js adapter for the ported Go route `POST /vsbot/concede`
 * (`controllers.ConcedeDebate`).
 */
export async function POST(request: Request) {
  return withVsBotBackend(request, (backend, actor, body) => backend.concedeDebate(actor, body))
}
