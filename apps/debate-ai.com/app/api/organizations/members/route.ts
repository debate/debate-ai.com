import { NextRequest, NextResponse } from "next/server"
import { and, eq, inArray, or } from "drizzle-orm"
import { getAuth } from "@/lib/auth"
import { getSession } from "@/lib/auth/session"
import { getDBFromContext } from "@/lib/database/context"
import { contacts, user } from "@/lib/database/schema"
import { filterShareableContacts, toContactUser, userSummaryColumns } from "@/lib/contacts/server"
import { canManageMembers, loadActiveOrganization } from "@/lib/organizations/server"

/**
 * Members of the session's active organization (better-auth organization
 * plugin; see lib/organizations/server.ts), and the one way to add them:
 * from the caller's own accepted contacts. No invitation emails are sent —
 * people join a group because someone they already trust added them.
 *
 * GET  — `{ organization, members, candidates }`: the members, and the
 *   caller's accepted contacts who are not members yet (empty unless the
 *   caller is an owner or admin). 400 with no active organization.
 * POST { userId } — owner/admin only; the user must be a shareable contact
 *   (accepted, no block either way). Adds them with the `member` role.
 */

function unauthorized() {
  return NextResponse.json({ error: "Sign in to manage organizations." }, { status: 401 })
}

function noActiveOrganization() {
  return NextResponse.json({ error: "Switch to an organization first." }, { status: 400 })
}

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()
  const me = session.user.id
  const db = await getDBFromContext()
  const org = await loadActiveOrganization(db, me, session.session.activeOrganizationId)
  if (!org) return noActiveOrganization()

  const usersById = async (ids: string[]) =>
    ids.length ? (await db.select(userSummaryColumns).from(user).where(inArray(user.id, ids))).map(toContactUser) : []
  const members = await usersById([...org.memberIds])

  let candidates: Awaited<ReturnType<typeof usersById>> = []
  if (canManageMembers(org.role)) {
    const pairs = await db
      .select({ requesterId: contacts.requesterId, addresseeId: contacts.addresseeId })
      .from(contacts)
      .where(and(eq(contacts.status, "accepted"), or(eq(contacts.requesterId, me), eq(contacts.addresseeId, me))))
    const contactIds = pairs
      .map((p: { requesterId: string; addresseeId: string }) => (p.requesterId === me ? p.addresseeId : p.requesterId))
      .filter((id: string) => !org.memberIds.has(id))
    candidates = await usersById([...(await filterShareableContacts(db, me, contactIds))])
  }

  return NextResponse.json({
    organization: { id: org.id, name: org.name, role: org.role },
    members,
    candidates,
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()
  const me = session.user.id

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }
  const { userId } = (body ?? {}) as { userId?: unknown }
  if (typeof userId !== "string" || !userId.trim()) {
    return NextResponse.json({ error: "Provide a userId." }, { status: 400 })
  }

  const db = await getDBFromContext()
  const org = await loadActiveOrganization(db, me, session.session.activeOrganizationId)
  if (!org) return noActiveOrganization()
  if (!canManageMembers(org.role)) {
    return NextResponse.json({ error: "Only an owner or admin can add members." }, { status: 403 })
  }
  if (org.memberIds.has(userId)) return NextResponse.json({ status: "already-member" })

  const shareable = await filterShareableContacts(db, me, [userId])
  if (!shareable.has(userId)) {
    return NextResponse.json({ error: "You can only add your own contacts." }, { status: 403 })
  }

  try {
    const auth = await getAuth()
    await auth.api.addMember({ body: { userId, organizationId: org.id, role: "member" } })
    return NextResponse.json({ status: "added" })
  } catch (error) {
    console.error("Failed to add organization member", error)
    return NextResponse.json({ error: "Failed to add that member." }, { status: 500 })
  }
}
