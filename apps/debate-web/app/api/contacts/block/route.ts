import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { userBlocks } from "@/lib/database/schema"
import { getSession } from "@/lib/auth/session"
import { findUserById, severPair } from "@/lib/contacts/server"

/**
 * Block list for the contacts graph (`user_blocks`; see `/api/contacts`).
 * Blocking is unilateral and invisible to the blocked account: they simply
 * can't reach you — `/api/contacts` refuses their requests with the same
 * generic message as any other refusal, `/api/card-shares` skips you as a
 * recipient, and any contact row or live share between you is severed here
 * in the same request (`severPair`). Requires a session.
 *
 * POST   { userId } — block (idempotent).
 * DELETE { userId } — unblock. Nothing severed by the block is restored; the
 *   two accounts start from "none" again.
 */

async function readUserId(req: NextRequest): Promise<string | null> {
  try {
    const body = (await req.json()) as { userId?: unknown }
    return typeof body?.userId === "string" && body.userId.trim() ? body.userId.trim() : null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Sign in to block users." }, { status: 401 })
  const me = session.user.id

  const targetId = await readUserId(req)
  if (!targetId) return NextResponse.json({ error: "Provide a userId." }, { status: 400 })
  if (targetId === me) return NextResponse.json({ error: "You can't block yourself." }, { status: 400 })

  try {
    const db = await getDBFromContext()
    const target = await findUserById(db, targetId)
    if (!target) return NextResponse.json({ error: "No account matches that user." }, { status: 404 })

    await db
      .insert(userBlocks)
      .values({ blockerId: me, blockedId: target.id, createdAt: new Date() })
      .onConflictDoNothing()
    await severPair(db, me, target.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Failed to block user", error)
    return NextResponse.json({ error: "Failed to block that user." }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Sign in to manage blocked users." }, { status: 401 })
  const me = session.user.id

  const targetId = await readUserId(req)
  if (!targetId) return NextResponse.json({ error: "Provide a userId." }, { status: 400 })

  try {
    const db = await getDBFromContext()
    await db.delete(userBlocks).where(and(eq(userBlocks.blockerId, me), eq(userBlocks.blockedId, targetId)))
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Failed to unblock user", error)
    return NextResponse.json({ error: "Failed to unblock that user." }, { status: 500 })
  }
}
