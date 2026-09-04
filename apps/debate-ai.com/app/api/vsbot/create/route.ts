import { withVsBotBackend } from "@/lib/practice-vs-ai/backend"

/**
 * POST /api/vsbot/create — start a Practice vs AI round.
 *
 * The Next.js adapter for the ported Go route `POST /vsbot/create`
 * (`controllers.CreateDebate`). All the logic lives in
 * `debate-practice-vs-ai`; this handler only supplies auth, the store and
 * the model client.
 */
export async function POST(request: Request) {
  return withVsBotBackend(request, (backend, actor, body) => backend.createDebate(actor, body))
}
