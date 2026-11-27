import { NextRequest, NextResponse } from "next/server"
import { and, asc, eq, inArray } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { contactGroupMembers, contactGroups } from "@/lib/database/schema"
import { getSession } from "@/lib/auth/session"
import { busyResponse, isTransientRouteError } from "@/lib/api/route-errors"
import { filterShareableContacts, isMissingTableError, type DB } from "@/lib/contacts/server"
import { loadActiveOrganization } from "@/lib/organizations/server"
import { MAX_CONTACT_GROUPS, MAX_CONTACT_GROUP_MEMBERS, normalizeContactGroupName } from "@debate-ai/team-collaboration"

/**
 * Personal contact groups ("teams") — named sets of the signed-in user's
 * contacts the share dialog can pick in one click (`contact_groups` /
 * `contact_group_members`; see `lib/database/schema.ts`). A group belongs to
 * its owner alone; recipients never learn which group they were picked from.
 * Every handler requires a session.
 *
 * GET    — `{ groups: [{ id, name, memberIds }] }`, by name.
 * POST   { name, memberIds? } — create. 409 on a duplicate name, 400 past the cap.
 * PATCH  { id, name?, memberIds? } — rename and/or replace the member list.
 * DELETE ?id= — delete a group (its member rows go with it).
 *
 * Members are kept to ids that are accepted, unblocked contacts (or members of
 * the active organization) at write time; anything else is silently dropped.
 */

const unauthorized = (message: string) => NextResponse.json({ error: message }, { status: 401 })
const badRequest = (message: string, status = 400) => NextResponse.json({ error: message }, { status })

type GroupRecord = { id: number; name: string; memberIds: string[] }

async function loadGroups(db: DB, ownerId: string): Promise<GroupRecord[]> {
  const groups: { id: number; name: string }[] = await db
    .select({ id: contactGroups.id, name: contactGroups.name })
    .from(contactGroups)
    .where(eq(contactGroups.ownerId, ownerId))
    .orderBy(asc(contactGroups.name))
  if (groups.length === 0) return []
  const members: { groupId: number; userId: string }[] = await db
    .select({ groupId: contactGroupMembers.groupId, userId: contactGroupMembers.userId })
    .from(contactGroupMembers)
    .where(
      inArray(
        contactGroupMembers.groupId,
        groups.map((g) => g.id),
      ),
    )
  const byGroup = new Map<number, string[]>()
  for (const m of members) byGroup.set(m.groupId, [...(byGroup.get(m.groupId) ?? []), m.userId])
  return groups.map((g) => ({ ...g, memberIds: byGroup.get(g.id) ?? [] }))
}

async function readBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json()
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** `undefined` when the field is absent, `null` when present but not a list of ids. */
function readMemberIds(value: unknown): string[] | null | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) return null
  return [...new Set((value as string[]).map((v) => v.trim()).filter(Boolean))]
}

async function allowedMemberIds(
  db: DB,
  me: string,
  organizationId: string | null | undefined,
  candidates: string[],
): Promise<string[]> {
  if (candidates.length === 0) return []
  const org = await loadActiveOrganization(db, me, organizationId)
  const ok = await filterShareableContacts(db, me, candidates, org ? new Set(org.memberIds) : new Set())
  return candidates.filter((id) => ok.has(id))
}

async function replaceMembers(db: DB, groupId: number, memberIds: string[]): Promise<void> {
  await db.delete(contactGroupMembers).where(eq(contactGroupMembers.groupId, groupId))
  if (memberIds.length === 0) return
  const now = new Date()
  await db
    .insert(contactGroupMembers)
    .values(memberIds.map((userId) => ({ groupId, userId, createdAt: now })))
    .onConflictDoNothing()
}

function failure(error: unknown, label: string) {
  if (isTransientRouteError(error)) {
    console.warn(`${label} busy`, error)
    return busyResponse()
  }
  console.error(label, error)
  return NextResponse.json({ error: label }, { status: 500 })
}

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized("Sign in to see your contact groups.")
  try {
    const db = await getDBFromContext()
    return NextResponse.json({ groups: await loadGroups(db, session.user.id) })
  } catch (error) {
    if (isMissingTableError(error)) {
      console.warn("Contact group tables missing (migration pending)", error)
      return NextResponse.json({ groups: [] })
    }
    return failure(error, "Failed to load contact groups.")
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized("Sign in to create a contact group.")
  const me = session.user.id

  const body = await readBody(req)
  if (!body) return badRequest("Invalid JSON body.")
  const name = normalizeContactGroupName(body.name)
  if (!name) return badRequest("Give the group a name.")
  const requested = readMemberIds(body.memberIds)
  if (requested === null) return badRequest("memberIds must be a list of user ids.")
  if (requested && requested.length > MAX_CONTACT_GROUP_MEMBERS) {
    return badRequest(`A group holds up to ${MAX_CONTACT_GROUP_MEMBERS} contacts.`)
  }

  try {
    const db = await getDBFromContext()
    const existing = await loadGroups(db, me)
    if (existing.length >= MAX_CONTACT_GROUPS) {
      return badRequest(`You can have up to ${MAX_CONTACT_GROUPS} groups.`)
    }
    if (existing.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
      return badRequest("You already have a group with that name.", 409)
    }
    const memberIds = await allowedMemberIds(db, me, session.session.activeOrganizationId, requested ?? [])
    const now = new Date()
    const [row] = await db
      .insert(contactGroups)
      .values({ ownerId: me, name, createdAt: now, updatedAt: now })
      .returning({ id: contactGroups.id })
    await replaceMembers(db, row.id, memberIds)
    return NextResponse.json({ group: { id: row.id, name, memberIds } })
  } catch (error) {
    return failure(error, "Failed to create that group.")
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized("Sign in to edit a contact group.")
  const me = session.user.id

  const body = await readBody(req)
  if (!body) return badRequest("Invalid JSON body.")
  const id = Number(body.id)
  if (!Number.isInteger(id)) return badRequest("Provide a group id.")

  const name = body.name === undefined ? undefined : normalizeContactGroupName(body.name)
  if (name === null) return badRequest("Give the group a name.")
  const requested = readMemberIds(body.memberIds)
  if (requested === null) return badRequest("memberIds must be a list of user ids.")
  if (requested && requested.length > MAX_CONTACT_GROUP_MEMBERS) {
    return badRequest(`A group holds up to ${MAX_CONTACT_GROUP_MEMBERS} contacts.`)
  }

  try {
    const db = await getDBFromContext()
    const groups = await loadGroups(db, me)
    const current = groups.find((g) => g.id === id)
    if (!current) return badRequest("No group with that id.", 404)
    if (name !== undefined && groups.some((g) => g.id !== id && g.name.toLowerCase() === name.toLowerCase())) {
      return badRequest("You already have a group with that name.", 409)
    }

    if (name !== undefined) {
      await db
        .update(contactGroups)
        .set({ name, updatedAt: new Date() })
        .where(and(eq(contactGroups.id, id), eq(contactGroups.ownerId, me)))
    }
    let memberIds = current.memberIds
    if (requested !== undefined) {
      memberIds = await allowedMemberIds(db, me, session.session.activeOrganizationId, requested)
      await replaceMembers(db, id, memberIds)
      await db.update(contactGroups).set({ updatedAt: new Date() }).where(eq(contactGroups.id, id))
    }
    return NextResponse.json({ group: { id, name: name ?? current.name, memberIds } })
  } catch (error) {
    return failure(error, "Failed to update that group.")
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized("Sign in to delete a contact group.")
  const id = Number(req.nextUrl.searchParams.get("id"))
  if (!Number.isInteger(id)) return badRequest("Provide a group id.")

  try {
    const db = await getDBFromContext()
    const owned = await db
      .select({ id: contactGroups.id })
      .from(contactGroups)
      .where(and(eq(contactGroups.id, id), eq(contactGroups.ownerId, session.user.id)))
      .limit(1)
    if (owned.length === 0) return badRequest("No group with that id.", 404)
    await db.delete(contactGroupMembers).where(eq(contactGroupMembers.groupId, id))
    await db.delete(contactGroups).where(eq(contactGroups.id, id))
    return NextResponse.json({ ok: true })
  } catch (error) {
    return failure(error, "Failed to delete that group.")
  }
}
