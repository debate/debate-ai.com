import { NextRequest, NextResponse } from "next/server"
import { and, desc, eq, isNull } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { cardShares, user } from "@/lib/database/schema"
import { getSession } from "@/lib/auth/session"
import {
  filterShareableContacts,
  isMissingTableError,
  notifyUser,
  toContactUser,
  userSummaryColumns,
} from "@/lib/contacts/server"
import {
  normalizeCardShareMessage,
  normalizeCardShareTitle,
  parseShareCode,
} from "debate-team-collaboration"

/**
 * Collab-card shares — a CardMirror co-editing session's share code (and
 * relay guest pass) handed from one account to a contact, so the card shows
 * up as available on the recipient's account instead of only on the
 * clipboard the invite link was pasted into (`card_shares` in
 * `lib/database/schema.ts`; see docs/features/contacts.md). Shares only
 * ever go to accepted contacts with no block in either direction —
 * `filterShareableContacts` — and blocking revokes them. Requires a session.
 *
 * GET   — `{ received, sent }`, live shares only (no `revokedAt`), newest
 *   first, each with the other party's user summary.
 * POST  { shareCode, guestPass?, title?, message?, recipientIds: string[] }
 *   — validates the code's format (`parseShareCode`), upserts one row per
 *   shareable recipient keyed on `(roomId, recipientId)` (re-sharing the
 *   same room refreshes the code/pass, clears any revoke, and re-notifies),
 *   and returns `{ shared, skipped }` ids.
 * PATCH { id, action: "opened" } — recipient marks first open.
 * DELETE ?id= — owner revokes (row kept, `revokedAt` set, so a re-share
 *   upserts cleanly); recipient dismisses (row deleted).
 */

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 })
}

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null)

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized("Sign in to see shared cards.")
  const me = session.user.id

  try {
    const db = await getDBFromContext()
    const base = {
      id: cardShares.id,
      roomId: cardShares.roomId,
      shareCode: cardShares.shareCode,
      guestPass: cardShares.guestPass,
      title: cardShares.title,
      message: cardShares.message,
      createdAt: cardShares.createdAt,
      updatedAt: cardShares.updatedAt,
      openedAt: cardShares.openedAt,
      other: userSummaryColumns,
    }
    const received = await db
      .select(base)
      .from(cardShares)
      .innerJoin(user, eq(user.id, cardShares.ownerId))
      .where(and(eq(cardShares.recipientId, me), isNull(cardShares.revokedAt)))
      .orderBy(desc(cardShares.updatedAt))
    const sent = await db
      .select(base)
      .from(cardShares)
      .innerJoin(user, eq(user.id, cardShares.recipientId))
      .where(and(eq(cardShares.ownerId, me), isNull(cardShares.revokedAt)))
      .orderBy(desc(cardShares.updatedAt))

    const shape = (r: (typeof received)[number]) => ({
      id: r.id,
      user: toContactUser(r.other),
      roomId: r.roomId,
      shareCode: r.shareCode,
      guestPass: r.guestPass ?? null,
      title: r.title,
      message: r.message ?? null,
      createdAt: iso(r.createdAt),
      updatedAt: iso(r.updatedAt),
      openedAt: iso(r.openedAt),
    })
    return NextResponse.json({ received: received.map(shape), sent: sent.map(shape) })
  } catch (error) {
    if (isMissingTableError(error)) {
      console.warn("card_shares table missing (migration pending)", error)
      return NextResponse.json({ received: [], sent: [] })
    }
    console.error("Failed to load shared cards", error)
    return NextResponse.json({ error: "Failed to load shared cards." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized("Sign in to share cards.")
  const me = session.user.id

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }
  const { shareCode, guestPass, title, message, recipientIds } = (body ?? {}) as {
    shareCode?: unknown
    guestPass?: unknown
    title?: unknown
    message?: unknown
    recipientIds?: unknown
  }

  const parsed = typeof shareCode === "string" ? parseShareCode(shareCode) : null
  if (!parsed) {
    return NextResponse.json({ error: "That does not look like a share code." }, { status: 400 })
  }
  if (!Array.isArray(recipientIds) || !recipientIds.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "Provide recipientIds as an array of user ids." }, { status: 400 })
  }
  const pass = typeof guestPass === "string" && guestPass.trim() ? guestPass.trim().slice(0, 512) : null
  const cardTitle = normalizeCardShareTitle(title)
  const note = normalizeCardShareMessage(message)

  try {
    const db = await getDBFromContext()
    const shareable = await filterShareableContacts(db, me, recipientIds as string[])
    const shared: string[] = []
    const skipped: string[] = []
    const now = new Date()

    for (const recipientId of new Set(recipientIds as string[])) {
      if (!shareable.has(recipientId)) {
        skipped.push(recipientId)
        continue
      }
      await db
        .insert(cardShares)
        .values({
          ownerId: me,
          recipientId,
          roomId: parsed.roomId,
          shareCode: parsed.shareCode,
          guestPass: pass,
          title: cardTitle,
          message: note,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [cardShares.roomId, cardShares.recipientId],
          set: {
            ownerId: me,
            shareCode: parsed.shareCode,
            guestPass: pass,
            title: cardTitle,
            message: note,
            updatedAt: now,
            openedAt: null,
            revokedAt: null,
          },
        })
      await notifyUser(db, recipientId, {
        type: "card_shared",
        title: `${session.user.name} shared "${cardTitle}" with you`,
        body: note,
        link: "/contacts?tab=shared",
      })
      shared.push(recipientId)
    }

    return NextResponse.json({ shared, skipped })
  } catch (error) {
    console.error("Failed to share card", error)
    return NextResponse.json({ error: "Failed to share that card." }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized("Sign in to open shared cards.")
  const me = session.user.id

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }
  const { id, action } = (body ?? {}) as { id?: unknown; action?: unknown }
  const rowId = Number(id)
  if (!Number.isInteger(rowId) || action !== "opened") {
    return NextResponse.json({ error: "Provide a share id and the action \"opened\"." }, { status: 400 })
  }

  try {
    const db = await getDBFromContext()
    await db
      .update(cardShares)
      .set({ openedAt: new Date() })
      .where(and(eq(cardShares.id, rowId), eq(cardShares.recipientId, me), isNull(cardShares.openedAt)))
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Failed to mark share opened", error)
    return NextResponse.json({ error: "Failed to update that share." }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized("Sign in to manage shared cards.")
  const me = session.user.id

  const rowId = Number(req.nextUrl.searchParams.get("id"))
  if (!Number.isInteger(rowId)) {
    return NextResponse.json({ error: "Provide a share id." }, { status: 400 })
  }

  try {
    const db = await getDBFromContext()
    const rows = await db.select().from(cardShares).where(eq(cardShares.id, rowId)).limit(1)
    const row = rows[0]
    if (!row || (row.ownerId !== me && row.recipientId !== me)) {
      return NextResponse.json({ error: "No share with that id." }, { status: 404 })
    }
    if (row.ownerId === me) {
      const now = new Date()
      await db.update(cardShares).set({ revokedAt: now, updatedAt: now }).where(eq(cardShares.id, rowId))
    } else {
      await db.delete(cardShares).where(eq(cardShares.id, rowId))
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Failed to remove share", error)
    return NextResponse.json({ error: "Failed to remove that share." }, { status: 500 })
  }
}
