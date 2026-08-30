import { NextRequest, NextResponse } from "next/server"
import { desc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { rounds } from "@/lib/database/schema"
import { getUserId, requireUserId } from "@/lib/auth/session"

/**
 * Cloud-saved FIAT rounds collection (see lib/hooks/useRoundsCloudSync.ts).
 * GET lists the signed-in user's rounds for list rendering (title/format/
 * updatedAt only — not the full flow snapshot). POST upserts a round by its
 * caller-assigned id, same convention as /api/flow-sync, so the sync hook's
 * repeated debounced saves are idempotent.
 */

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json([])

  const db = await getDBFromContext()
  const rows = await db
    .select({
      id: rounds.id,
      title: rounds.title,
      format: rounds.format,
      updatedAt: rounds.updatedAt,
    })
    .from(rounds)
    .where(eq(rounds.userId, userId))
    .orderBy(desc(rounds.updatedAt))

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId().catch(() => null)
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { id?: number; title?: string; format?: string; data?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  if (typeof body.id !== "number" || !Number.isFinite(body.id)) {
    return NextResponse.json({ error: "id must be a number." }, { status: 400 })
  }
  if (body.data === undefined) {
    return NextResponse.json({ error: "data is required." }, { status: 400 })
  }

  const db = await getDBFromContext()

  // A round already owned by someone else can't be silently taken over by a
  // same-id upsert from a different account.
  const [existing] = await db.select({ userId: rounds.userId }).from(rounds).where(eq(rounds.id, body.id)).limit(1)
  if (existing && existing.userId && existing.userId !== userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const values = {
    id: body.id,
    userId,
    title: body.title?.trim() || "Untitled Round",
    format: body.format ?? null,
    data: JSON.stringify(body.data),
    updatedAt: new Date(),
  }

  const [saved] = await db
    .insert(rounds)
    .values(values)
    .onConflictDoUpdate({ target: rounds.id, set: values })
    .returning({ id: rounds.id, title: rounds.title, format: rounds.format, updatedAt: rounds.updatedAt })

  return NextResponse.json(saved, { status: 201 })
}
