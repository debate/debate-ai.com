import { withVsBotBackend } from "@/lib/practice-vs-ai/backend"

/**
 * POST /api/vsbot/prep — the opponent's pre-round prep on the merged
 * Practice vs AI page: turns the cards and caselist outlines the page found
 * for the topic into a case brief for both sides.
 *
 * Not a Go-ported route. The logic lives in `debate-practice-vs-ai`'s
 * `backend/case-prep.ts`; this handler only supplies auth and the model.
 */
export async function POST(request: Request) {
  return withVsBotBackend(request, (backend, actor, body) => backend.prepareCase(actor, body))
}
