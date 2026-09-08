import { and, eq, inArray, or } from "drizzle-orm"
import type { getDBFromContext } from "@/lib/database/context"
import { cardShares, contacts, notifications, user, userBlocks, userPresence } from "@/lib/database/schema"
import {
  deriveRelationship,
  type BlockPair,
  type ContactPair,
  type ContactRelationship,
  type ContactUser,
} from "debate-team-collaboration"

/**
 * Server-side helpers shared by `/api/contacts`, `/api/contacts/block`, and
 * `/api/card-shares` — the query half of the contacts graph whose rules live
 * in `debate-team-collaboration`'s `lib/contacts.ts`. Everything takes the
 * drizzle handle from `getDBFromContext()` so route tests can pass a fake.
 */

export type DB = Awaited<ReturnType<typeof getDBFromContext>>

/** The `{ id, name, email, image }` projection every contacts endpoint returns for another account. */
export const userSummaryColumns = { id: user.id, name: user.name, email: user.email, image: user.image }

export function toContactUser(row: { id: string; name: string; email: string; image: string | null }): ContactUser {
  return { id: row.id, name: row.name, email: row.email, image: row.image ?? null }
}

/** Every `contacts` row between two ids (either direction) as the pure module's shape. */
export async function loadPairs(db: DB, a: string, b: string): Promise<ContactPair[]> {
  const rows = await db
    .select({
      id: contacts.id,
      requesterId: contacts.requesterId,
      addresseeId: contacts.addresseeId,
      status: contacts.status,
    })
    .from(contacts)
    .where(
      or(
        and(eq(contacts.requesterId, a), eq(contacts.addresseeId, b)),
        and(eq(contacts.requesterId, b), eq(contacts.addresseeId, a)),
      ),
    )
  return rows.map((r: { id: number; requesterId: string; addresseeId: string; status: string }) => ({
    ...r,
    status: r.status === "accepted" ? "accepted" : "pending",
  }))
}

/** Every `user_blocks` row between two ids (either direction). */
export async function loadBlocks(db: DB, a: string, b: string): Promise<BlockPair[]> {
  return db
    .select({ blockerId: userBlocks.blockerId, blockedId: userBlocks.blockedId })
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerId, a), eq(userBlocks.blockedId, b)),
        and(eq(userBlocks.blockerId, b), eq(userBlocks.blockedId, a)),
      ),
    )
}

export async function loadRelationship(db: DB, viewerId: string, targetId: string): Promise<ContactRelationship> {
  const [pairs, blocks] = await Promise.all([loadPairs(db, viewerId, targetId), loadBlocks(db, viewerId, targetId)])
  return deriveRelationship(viewerId, targetId, pairs, blocks)
}

/** Ids among `candidateIds` that are accepted contacts of `viewerId` with no block in either direction. */
export async function filterShareableContacts(db: DB, viewerId: string, candidateIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(candidateIds)].filter((id) => id && id !== viewerId)
  if (ids.length === 0) return new Set()
  const [pairs, blocks] = await Promise.all([
    db
      .select({ requesterId: contacts.requesterId, addresseeId: contacts.addresseeId })
      .from(contacts)
      .where(
        and(
          eq(contacts.status, "accepted"),
          or(
            and(eq(contacts.requesterId, viewerId), inArray(contacts.addresseeId, ids)),
            and(eq(contacts.addresseeId, viewerId), inArray(contacts.requesterId, ids)),
          ),
        ),
      ),
    db
      .select({ blockerId: userBlocks.blockerId, blockedId: userBlocks.blockedId })
      .from(userBlocks)
      .where(
        or(
          and(eq(userBlocks.blockerId, viewerId), inArray(userBlocks.blockedId, ids)),
          and(eq(userBlocks.blockedId, viewerId), inArray(userBlocks.blockerId, ids)),
        ),
      ),
  ])
  const blocked = new Set<string>()
  for (const b of blocks) blocked.add(b.blockerId === viewerId ? b.blockedId : b.blockerId)
  const ok = new Set<string>()
  for (const p of pairs) {
    const other = p.requesterId === viewerId ? p.addresseeId : p.requesterId
    if (!blocked.has(other)) ok.add(other)
  }
  return ok
}

/** Drops every contact row and revokes every card share between two ids, both directions — what a block does. */
export async function severPair(db: DB, a: string, b: string): Promise<void> {
  const now = new Date()
  await db
    .delete(contacts)
    .where(
      or(
        and(eq(contacts.requesterId, a), eq(contacts.addresseeId, b)),
        and(eq(contacts.requesterId, b), eq(contacts.addresseeId, a)),
      ),
    )
  await db
    .update(cardShares)
    .set({ revokedAt: now, updatedAt: now })
    .where(
      or(
        and(eq(cardShares.ownerId, a), eq(cardShares.recipientId, b)),
        and(eq(cardShares.ownerId, b), eq(cardShares.recipientId, a)),
      ),
    )
}

/** Writes an in-app notification (see `/api/notifications`); failures are logged, never fatal to the caller. */
export async function notifyUser(
  db: DB,
  userId: string,
  entry: { type: string; title: string; body?: string | null; link?: string | null },
): Promise<void> {
  try {
    await db.insert(notifications).values({
      userId,
      type: entry.type,
      title: entry.title,
      body: entry.body ?? null,
      link: entry.link ?? null,
      createdAt: new Date(),
    })
  } catch (error) {
    console.warn("Failed to write notification", error)
  }
}

/** Upserts the caller's presence heartbeat. Best-effort: a missing table (pre-migration) must not break the read it rides on. */
export async function touchPresence(db: DB, userId: string): Promise<void> {
  try {
    const now = new Date()
    await db
      .insert(userPresence)
      .values({ userId, lastSeenAt: now })
      .onConflictDoUpdate({ target: userPresence.userId, set: { lastSeenAt: now } })
  } catch (error) {
    console.warn("Failed to record presence", error)
  }
}

/** A user row by exact (case-insensitive) email, or null. */
export async function findUserByEmail(db: DB, email: string): Promise<ContactUser | null> {
  const rows = await db.select(userSummaryColumns).from(user).where(eq(user.email, email.trim().toLowerCase())).limit(1)
  return rows[0] ? toContactUser(rows[0]) : null
}

export async function findUserById(db: DB, id: string): Promise<ContactUser | null> {
  const rows = await db.select(userSummaryColumns).from(user).where(eq(user.id, id)).limit(1)
  return rows[0] ? toContactUser(rows[0]) : null
}

/** Whether the thrown error is D1/SQLite's "no such table" — the migration for these tables hasn't run yet. */
export function isMissingTableError(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error)
  return /no such table/i.test(text)
}
