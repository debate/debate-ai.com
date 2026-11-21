import { withVsBotBackend } from "@/lib/practice-vs-ai/backend"

/**
 * POST /api/vsbot/debrief — keep the scorecard's Coach debrief with its
 * round, so Debate History shows it again.
 *
 * Not a Go-ported route. A signed-out player's round is kept nowhere, so
 * the guest store answers `{ saved: false }` instead of an error.
 */
export async function POST(request: Request) {
  return withVsBotBackend(request, (backend, actor, body) => backend.saveDebrief(actor, body))
}
