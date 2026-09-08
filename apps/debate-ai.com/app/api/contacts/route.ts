import { NextRequest, NextResponse } from "next/server"
import { and, eq, or } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { contacts, user, userBlocks, userPresence } from "@/lib/database/schema"
import { getSession } from "@/lib/auth/session"
import {
  findUserByEmail,
  findUserById,
  isMissingTableError,
  loadRelationship,
  notifyUser,
  toContactUser,
  touchPresence,
  userSummaryColumns,
} from "@/lib/contacts/server"
import { isPresenceOnline, resolveContactRequest } from "debate-team-collaboration"

/**
 * Account-linked contacts list — the friends-list half of the CardMirror
 * editor's real-time collaboration, keyed by better-auth user ids (see
 * `lib/database/schema.ts`'s `contacts`/`user_blocks` and
 * docs/features/contacts.md). Every handler requires a session and returns
 * 401 without one, like `/api/settings`; `debate-team-collaboration`'s
 * `useContacts` polls the GET.
 *
 * GET   — `{ contacts, incoming, outgoing, blocked }`, each row carrying the
 *   other account's `{ id, name, email, image }`; contacts also carry
 *   `online`/`lastSeenAt` from `user_presence`. The call itself bumps the
 *   caller's own presence row, so polling the list IS the heartbeat.
 * POST  { userId } | { email } — send a request. Outcome follows
 *   `resolveContactRequest`: a request at someone who already asked you
 *   accepts on the spot; self/blocked are refused. Writes a `contact_request`
 *   (or `contact_accepted`) notification for the other side.
 * PATCH { id, action: "accept" | "decline" } — addressee only.
 * DELETE ?id= — remove an accepted contact (either side) or cancel your own
 *   outgoing request.
 */

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 })
}

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized("Sign in to see your contacts.")
  const me = session.user.id

  try {
    const db = await getDBFromContext()
    await touchPresence(db, me)

    const pairRows = await db
      .select({
        id: contacts.id,
        requesterId: contacts.requesterId,
        addresseeId: contacts.addresseeId,
        status: contacts.status,
        createdAt: contacts.createdAt,
        updatedAt: contacts.updatedAt,
        other: userSummaryColumns,
        lastSeenAt: userPresence.lastSeenAt,
      })
      .from(contacts)
      .innerJoin(
        user,
        or(
          and(eq(contacts.requesterId, me), eq(user.id, contacts.addresseeId)),
          and(eq(contacts.addresseeId, me), eq(user.id, contacts.requesterId)),
        ),
      )
      .leftJoin(userPresence, eq(userPresence.userId, user.id))
      .where(or(eq(contacts.requesterId, me), eq(contacts.addresseeId, me)))

    const blockedRows = await db
      .select({ createdAt: userBlocks.createdAt, other: userSummaryColumns })
      .from(userBlocks)
      .innerJoin(user, eq(user.id, userBlocks.blockedId))
      .where(eq(userBlocks.blockerId, me))

    const now = Date.now()
    const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null)
    type PairRow = (typeof pairRows)[number]

    const accepted = pairRows.filter((r: PairRow) => r.status === "accepted")
    const incoming = pairRows.filter((r: PairRow) => r.status !== "accepted" && r.addresseeId === me)
    const outgoing = pairRows.filter((r: PairRow) => r.status !== "accepted" && r.requesterId === me)

    return NextResponse.json({
      contacts: accepted.map((r: PairRow) => ({
        id: r.id,
        user: toContactUser(r.other),
        online: isPresenceOnline(r.lastSeenAt, now),
        lastSeenAt: iso(r.lastSeenAt),
        since: iso(r.updatedAt) ?? iso(r.createdAt),
      })),
      incoming: incoming.map((r: PairRow) => ({ id: r.id, user: toContactUser(r.other), createdAt: iso(r.createdAt) })),
      outgoing: outgoing.map((r: PairRow) => ({ id: r.id, user: toContactUser(r.other), createdAt: iso(r.createdAt) })),
      blocked: blockedRows.map((r: (typeof blockedRows)[number]) => ({
        user: toContactUser(r.other),
        createdAt: iso(r.createdAt),
      })),
    })
  } catch (error) {
    // Pre-migration deploys: degrade to an empty list, same as /api/notifications.
    if (isMissingTableError(error)) {
      console.warn("Contacts tables missing (migration pending)", error)
      return NextResponse.json({ contacts: [], incoming: [], outgoing: [], blocked: [] })
    }
    console.error("Failed to load contacts", error)
    return NextResponse.json({ error: "Failed to load contacts." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized("Sign in to add contacts.")
  const me = session.user.id

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }
  const { userId, email } = (body ?? {}) as { userId?: unknown; email?: unknown }

  const db = await getDBFromContext()
  let target = null
  if (typeof userId === "string" && userId.trim()) {
    target = await findUserById(db, userId.trim())
  } else if (typeof email === "string" && email.trim()) {
    target = await findUserByEmail(db, email)
  } else {
    return NextResponse.json({ error: "Provide a userId or an email." }, { status: 400 })
  }
  if (!target) {
    return NextResponse.json({ error: "No account matches that user." }, { status: 404 })
  }

  try {
    const relationship = await loadRelationship(db, me, target.id)
    const outcome = resolveContactRequest(relationship)
    const now = new Date()

    switch (outcome.action) {
      case "reject":
        return NextResponse.json({ error: outcome.reason }, { status: relationship === "self" ? 400 : 403 })
      case "noop":
        return NextResponse.json({
          status: outcome.relationship === "contact" ? "already-contacts" : "already-requested",
        })
      case "accept": {
        // Their pending request to us becomes an accepted pair.
        await db
          .update(contacts)
          .set({ status: "accepted", updatedAt: now })
          .where(and(eq(contacts.requesterId, target.id), eq(contacts.addresseeId, me)))
        await notifyUser(db, target.id, {
          type: "contact_accepted",
          title: `${session.user.name} accepted your contact request`,
          link: "/contacts",
        })
        return NextResponse.json({ status: "accepted" })
      }
      case "create": {
        await db.insert(contacts).values({
          requesterId: me,
          addresseeId: target.id,
          status: "pending",
          createdAt: now,
          updatedAt: now,
        })
        await notifyUser(db, target.id, {
          type: "contact_request",
          title: `${session.user.name} wants to add you as a contact`,
          body: session.user.email,
          link: "/contacts",
        })
        return NextResponse.json({ status: "requested" })
      }
    }
  } catch (error) {
    console.error("Failed to send contact request", error)
    return NextResponse.json({ error: "Failed to send that contact request." }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized("Sign in to manage contact requests.")
  const me = session.user.id

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }
  const { id, action } = (body ?? {}) as { id?: unknown; action?: unknown }
  const rowId = Number(id)
  if (!Number.isInteger(rowId) || (action !== "accept" && action !== "decline")) {
    return NextResponse.json({ error: "Provide a request id and an action of accept or decline." }, { status: 400 })
  }

  try {
    const db = await getDBFromContext()
    const rows = await db.select().from(contacts).where(eq(contacts.id, rowId)).limit(1)
    const row = rows[0]
    // Only the addressee of a still-pending request can act on it. A row that
    // isn't ours reads as not-found rather than forbidden, so ids can't be
    // probed for who's asking whom.
    if (!row || row.addresseeId !== me || row.status !== "pending") {
      return NextResponse.json({ error: "No pending request with that id." }, { status: 404 })
    }
    if (action === "accept") {
      const now = new Date()
      await db.update(contacts).set({ status: "accepted", updatedAt: now }).where(eq(contacts.id, rowId))
      await notifyUser(db, row.requesterId, {
        type: "contact_accepted",
        title: `${session.user.name} accepted your contact request`,
        link: "/contacts",
      })
      return NextResponse.json({ ok: true, status: "accepted" })
    }
    await db.delete(contacts).where(eq(contacts.id, rowId))
    return NextResponse.json({ ok: true, status: "declined" })
  } catch (error) {
    console.error("Failed to update contact request", error)
    return NextResponse.json({ error: "Failed to update that request." }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized("Sign in to manage contacts.")
  const me = session.user.id

  const rowId = Number(req.nextUrl.searchParams.get("id"))
  if (!Number.isInteger(rowId)) {
    return NextResponse.json({ error: "Provide a contact id." }, { status: 400 })
  }

  try {
    const db = await getDBFromContext()
    const rows = await db.select().from(contacts).where(eq(contacts.id, rowId)).limit(1)
    const row = rows[0]
    const mine = row && (row.requesterId === me || row.addresseeId === me)
    // An accepted pair can be removed by either side; a pending request only
    // by whoever sent it (the addressee declines via PATCH instead).
    const allowed = mine && (row.status === "accepted" || row.requesterId === me)
    if (!allowed) {
      return NextResponse.json({ error: "No contact with that id." }, { status: 404 })
    }
    await db.delete(contacts).where(eq(contacts.id, rowId))
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Failed to remove contact", error)
    return NextResponse.json({ error: "Failed to remove that contact." }, { status: 500 })
  }
}
