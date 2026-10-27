import { getDBFromContext } from "@/lib/database/context"
import { getSession } from "@/lib/auth/session"
import { handleCollabRelay } from "@/lib/collab-relay/handler"

/**
 * The Debate Editor's collaboration relay — card sharing and real-time
 * co-editing through the signed-in account (see lib/collab-relay/handler.ts
 * for the endpoints and who may call them).
 */
async function handle(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const session = await getSession()
  const db = await getDBFromContext()
  const user = session ? { id: session.user.id, email: session.user.email, name: session.user.name } : null
  return handleCollabRelay(req, path ?? [], { db, user })
}

export const GET = handle
export const POST = handle
export const DELETE = handle
