import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedCustomOpponentPersonas } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import {
  isValidSavedCustomOpponentPersona,
  MAX_SAVED_CUSTOM_OPPONENT_PERSONA_BYTES,
} from "debate-speech-writer"

/**
 * Account-linked custom-opponent-persona-library sync — the "🤖 AI Practice
 * Opponent" idea's "share a custom-authored persona across a team instead
 * of per-user only" Next item in TODO.md. Single-entry CRUD, keyed by
 * `id` within the current user's rows — mirrors
 * `/api/drill-sets/[roundId]`'s account-only (401 without a session) mode.
 *
 * PUT    { entry: SavedCustomOpponentPersona } — validates
 *   (`isValidSavedCustomOpponentPersona`) and upserts, keyed by
 *   `(userId, id)`; the route's `id` must match `entry.id`. The `shared`
 *   flag is also written to its own column so
 *   `GET /api/custom-opponent-personas/shared` can filter across every
 *   user's rows without deserializing each one.
 * DELETE — removes the synced library entry for this `id`.
 *
 * No GET here: `GET /api/custom-opponent-personas` already returns every
 * entry in full, so there's no need for a single-entry fetch.
 */

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to sync your persona library to your account." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const entry = (body as { entry?: unknown } | null)?.entry
  if (!isValidSavedCustomOpponentPersona(entry)) {
    return NextResponse.json({ error: "Request body's \"entry\" is not a valid persona library entry." }, { status: 400 })
  }
  if (entry.id !== id) {
    return NextResponse.json({ error: "The entry's id must match the URL's id." }, { status: 400 })
  }

  const data = JSON.stringify(entry)
  if (data.length > MAX_SAVED_CUSTOM_OPPONENT_PERSONA_BYTES) {
    return NextResponse.json({ error: "This persona is too large to sync to your account." }, { status: 413 })
  }

  const db = await getDBFromContext()
  const now = new Date()

  await db
    .insert(savedCustomOpponentPersonas)
    .values({ userId, clientId: id, shared: entry.shared, data, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [savedCustomOpponentPersonas.userId, savedCustomOpponentPersonas.clientId],
      set: { shared: entry.shared, data, updatedAt: now },
    })

  return NextResponse.json({ id, updatedAt: now.toISOString() })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to manage your synced persona library." }, { status: 401 })
  }

  const db = await getDBFromContext()
  await db
    .delete(savedCustomOpponentPersonas)
    .where(and(eq(savedCustomOpponentPersonas.userId, userId), eq(savedCustomOpponentPersonas.clientId, id)))

  return NextResponse.json({ success: true })
}
