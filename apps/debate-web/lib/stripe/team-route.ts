import { NextResponse } from "next/server"
import { getSession, type AuthSession } from "@/lib/auth/session"
import { getDBFromContext } from "@/lib/database/context"
import { TeamError } from "./team"

/**
 * Shared shell for the `/api/team/*` routes: 401 without a session, and a
 * `TeamError` thrown by `team.ts` becomes its own status and message.
 */
export async function teamRoute(
  handler: (db: any, session: AuthSession) => Promise<unknown>,
): Promise<Response> {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Sign in to use team features." }, { status: 401 })
  try {
    const db = await getDBFromContext()
    return NextResponse.json(await handler(db, session))
  } catch (error) {
    if (error instanceof TeamError) return NextResponse.json({ error: error.message }, { status: error.status })
    throw error
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json()
    return body && typeof body === "object" ? body : {}
  } catch {
    throw new TeamError("Invalid JSON body.", 400)
  }
}
