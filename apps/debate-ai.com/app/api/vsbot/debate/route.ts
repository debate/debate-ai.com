import { withVsBotBackend } from "@/lib/practice-vs-ai/backend"

/**
 * POST /api/vsbot/debate — generate the bot's next turn.
 *
 * The Next.js adapter for the ported Go route `POST /vsbot/debate`
 * (`controllers.SendDebateMessage`).
 */
export async function POST(request: Request) {
  return withVsBotBackend(request, (backend, actor, body) => backend.sendDebateMessage(actor, body))
}
