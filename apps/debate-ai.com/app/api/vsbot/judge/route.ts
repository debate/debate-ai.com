import { withVsBotBackend } from "@/lib/practice-vs-ai/backend"

/**
 * POST /api/vsbot/judge — score a finished round.
 *
 * The Next.js adapter for the ported Go route `POST /vsbot/judge`
 * (`controllers.JudgeDebate`).
 */
export async function POST(request: Request) {
  return withVsBotBackend(request, (backend, actor, body) => backend.judgeDebate(actor, body))
}
