/**
 * @fileoverview D1 storage for the collaboration relay (`./handler.ts`): rooms,
 * their update logs and snapshots, presence frames, and card-sharing
 * mailboxes. The tables are declared in `lib/database/schema.ts`
 * (`collabRelay*`) and created by
 * `packages/debate-webview/migrations/0003_collab_relay.sql`.
 *
 * Blobs are stored as base64 text split into {@link PART_CHARS}-sized parts,
 * because one D1 row holds at most 2 MB and a large document's first update
 * is bigger than that. Every multi-statement write goes through `db.batch()`,
 * which D1 runs as one transaction and bills as one query: an update's
 * sequence number is picked by the insert itself (`MAX(seq) + 1`), so two
 * participants posting at once can never be given the same number, and a
 * reader never sees half of a blob.
 *
 * @module lib/collab-relay/store
 */

import { and, asc, desc, eq, gt, inArray, lt, lte, ne, sql } from "drizzle-orm"

import {
  collabRelayBlobs,
  collabRelayMailboxes,
  collabRelayMessages,
  collabRelayPresence,
  collabRelayRooms,
} from "@/lib/database/schema"
import type { getDBFromContext } from "@/lib/database/context"

export type RelayDb = Awaited<ReturnType<typeof getDBFromContext>>

/** Base64 characters per stored part — comfortably under D1's 2 MB row cap. */
export const PART_CHARS = 1_500_000
/** Largest update / snapshot / sealed card the relay accepts, in base64 characters. */
export const MAX_BLOB_CHARS = 12 * 1024 * 1024
/** Update rows per catch-up page, and the base64 budget one page may carry. */
const PAGE_ROWS = 200
const PAGE_CHARS = 4 * 1024 * 1024
/** Presence frames are only useful for a few seconds. */
export const PRESENCE_TTL_MS = 30_000
/** Undelivered cards expire after a week. */
export const MESSAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000
/** Rooms nobody has touched for this long are deleted, with their logs. */
export const ROOM_TTL_MS = 60 * 24 * 60 * 60 * 1000

export type RoomRow = typeof collabRelayRooms.$inferSelect

/** `db.batch()` exists on both the D1 and the libSQL drizzle drivers; their types just don't unify. */
async function batch(db: RelayDb, statements: unknown[]): Promise<unknown[]> {
  return (db as unknown as { batch(s: unknown[]): Promise<unknown[]> }).batch(statements)
}

export function splitParts(data: string): string[] {
  if (data.length <= PART_CHARS) return [data]
  const parts: string[] = []
  for (let i = 0; i < data.length; i += PART_CHARS) parts.push(data.slice(i, i + PART_CHARS))
  return parts
}

export async function getRoom(db: RelayDb, roomId: string): Promise<RoomRow | null> {
  const rows = await db.select().from(collabRelayRooms).where(eq(collabRelayRooms.roomId, roomId)).limit(1)
  return rows[0] ?? null
}

export async function createRoom(
  db: RelayDb,
  room: { roomId: string; ownerId: string; guestPass: string },
  now: number,
): Promise<void> {
  const stale = db
    .select({ roomId: collabRelayRooms.roomId })
    .from(collabRelayRooms)
    .where(lt(collabRelayRooms.updatedAt, now - ROOM_TTL_MS))
  await batch(db, [
    // Opening a room is rare enough to carry the garbage collection.
    db.delete(collabRelayBlobs).where(inArray(collabRelayBlobs.roomId, stale)),
    db.delete(collabRelayPresence).where(inArray(collabRelayPresence.roomId, stale)),
    db.delete(collabRelayRooms).where(lt(collabRelayRooms.updatedAt, now - ROOM_TTL_MS)),
    db.insert(collabRelayRooms).values({ ...room, snapshotCovers: 0, createdAt: now, updatedAt: now }),
  ])
}

/** Ends a room for everyone: it answers 410 from now on, and its data goes. */
export async function endRoom(db: RelayDb, roomId: string, now: number): Promise<void> {
  await batch(db, [
    db.update(collabRelayRooms).set({ endedAt: now, updatedAt: now }).where(eq(collabRelayRooms.roomId, roomId)),
    db.delete(collabRelayBlobs).where(eq(collabRelayBlobs.roomId, roomId)),
    db.delete(collabRelayPresence).where(eq(collabRelayPresence.roomId, roomId)),
  ])
}

/** The highest seq the room has handed out: its last update, or the snapshot's floor. */
export async function roomLastSeq(db: RelayDb, room: RoomRow): Promise<number> {
  const rows = await db
    .select({ seq: sql<number | null>`max(${collabRelayBlobs.seq})` })
    .from(collabRelayBlobs)
    .where(and(eq(collabRelayBlobs.roomId, room.roomId), eq(collabRelayBlobs.kind, "u")))
  return Math.max(Number(rows[0]?.seq ?? 0), room.snapshotCovers)
}

/** Appends one update to the room's log and returns the seq it was given. */
export async function appendUpdate(db: RelayDb, roomId: string, data: string, now: number): Promise<number> {
  const parts = splitParts(data)
  const maxU = sql`(SELECT max(seq) FROM collab_relay_blobs WHERE room_id = ${roomId} AND kind = 'u')`
  const covers = sql`(SELECT snapshot_covers FROM collab_relay_rooms WHERE room_id = ${roomId})`
  const statements: unknown[] = [
    db.run(sql`INSERT INTO collab_relay_blobs (room_id, kind, seq, part, parts, data, created_at)
      VALUES (${roomId}, 'u', max(coalesce(${maxU}, 0), coalesce(${covers}, 0)) + 1, 0, ${parts.length}, ${parts[0]}, ${now})`),
  ]
  // Later parts reuse the seq the first part was just given — inside the
  // batch's transaction it is still the room's highest.
  for (let i = 1; i < parts.length; i++) {
    statements.push(
      db.run(sql`INSERT INTO collab_relay_blobs (room_id, kind, seq, part, parts, data, created_at)
        VALUES (${roomId}, 'u', ${maxU}, ${i}, ${parts.length}, ${parts[i]}, ${now})`),
    )
  }
  statements.push(db.update(collabRelayRooms).set({ updatedAt: now }).where(eq(collabRelayRooms.roomId, roomId)))
  statements.push(
    db
      .select({ seq: sql<number | null>`max(${collabRelayBlobs.seq})` })
      .from(collabRelayBlobs)
      .where(and(eq(collabRelayBlobs.roomId, roomId), eq(collabRelayBlobs.kind, "u"))),
  )
  const results = await batch(db, statements)
  const last = results[results.length - 1] as Array<{ seq: number | null }>
  return Number(last[0]?.seq ?? 0)
}

/** Stored parts grouped back into whole blobs, in order. A trailing group
 *  cut short by a row limit is dropped (and reported) so it is fetched whole
 *  next time. */
function joinParts(rows: Array<{ seq: number; part: number; parts: number; data: string }>): {
  blobs: Array<{ seq: number; blob: string }>
  truncated: boolean
} {
  const blobs: Array<{ seq: number; blob: string }> = []
  let current: { seq: number; parts: number; chunks: string[] } | null = null
  const flush = () => {
    if (current && current.chunks.length === current.parts) blobs.push({ seq: current.seq, blob: current.chunks.join("") })
  }
  for (const row of rows) {
    if (!current || current.seq !== row.seq) {
      flush()
      current = { seq: row.seq, parts: row.parts, chunks: [] }
    }
    current.chunks[row.part] = row.data
  }
  const truncated = !!current && current.chunks.filter((c) => c !== undefined).length !== current.parts
  flush()
  return { blobs, truncated }
}

/** Update rows after `after`, at most `limit` parts. */
function updatesAfterQuery(db: RelayDb, roomId: string, after: number, limit: number) {
  return db
    .select({
      seq: collabRelayBlobs.seq,
      part: collabRelayBlobs.part,
      parts: collabRelayBlobs.parts,
      data: collabRelayBlobs.data,
    })
    .from(collabRelayBlobs)
    .where(and(eq(collabRelayBlobs.roomId, roomId), eq(collabRelayBlobs.kind, "u"), gt(collabRelayBlobs.seq, after)))
    .orderBy(asc(collabRelayBlobs.seq), asc(collabRelayBlobs.part))
    .limit(limit)
}

export interface UpdatesPage {
  snapshot: { blob: string; coversThroughSeq: number } | null
  snapshotUnchanged: boolean
  snapCovers: number
  updates: Array<{ seq: number; blob: string }>
  lastSeq: number
  more: boolean
}

/**
 * One catch-up page, in the shape the editor's `RoomsClient.fetchUpdates`
 * reads. A caller whose cursor is below the snapshot's floor gets the
 * snapshot (unless `haveSnap` says it already holds that exact one) and the
 * log after it; everyone else gets the log after their cursor.
 */
export async function fetchUpdatesPage(
  db: RelayDb,
  room: RoomRow,
  after: number,
  haveSnap: number | undefined,
): Promise<UpdatesPage> {
  const covers = room.snapshotCovers
  let snapshot: UpdatesPage["snapshot"] = null
  let snapshotUnchanged = false
  let from = after
  if (covers > 0 && after < covers) {
    from = covers
    if (haveSnap === covers) {
      snapshotUnchanged = true
    } else {
      const rows = await db
        .select({
          seq: collabRelayBlobs.seq,
          part: collabRelayBlobs.part,
          parts: collabRelayBlobs.parts,
          data: collabRelayBlobs.data,
        })
        .from(collabRelayBlobs)
        .where(and(eq(collabRelayBlobs.roomId, room.roomId), eq(collabRelayBlobs.kind, "s")))
        .orderBy(asc(collabRelayBlobs.seq), asc(collabRelayBlobs.part))
      const joined = joinParts(rows).blobs.find((b) => b.seq === covers)
      if (joined) snapshot = { blob: joined.blob, coversThroughSeq: covers }
      else from = after // no readable snapshot: fall back to whatever log is left
    }
  }
  const rows = await updatesAfterQuery(db, room.roomId, from, PAGE_ROWS + 1)
  const { blobs, truncated } = joinParts(rows.slice(0, PAGE_ROWS))
  let more = rows.length > PAGE_ROWS || truncated
  const updates: Array<{ seq: number; blob: string }> = []
  let chars = snapshot?.blob.length ?? 0
  for (const blob of blobs) {
    if (updates.length > 0 && chars + blob.blob.length > PAGE_CHARS) {
      more = true
      break
    }
    updates.push(blob)
    chars += blob.blob.length
  }
  const lastSeq = updates.length > 0 ? updates[updates.length - 1].seq : from
  return { snapshot, snapshotUnchanged, snapCovers: covers, updates, lastSeq, more }
}

/** Stores a snapshot covering the log through `covers` and drops the log it replaces. */
export async function storeSnapshot(
  db: RelayDb,
  room: RoomRow,
  data: string,
  covers: number,
  now: number,
): Promise<void> {
  const parts = splitParts(data)
  await batch(db, [
    db.delete(collabRelayBlobs).where(and(eq(collabRelayBlobs.roomId, room.roomId), eq(collabRelayBlobs.kind, "s"))),
    ...parts.map((chunk, part) =>
      db.insert(collabRelayBlobs).values({
        roomId: room.roomId,
        kind: "s",
        seq: covers,
        part,
        parts: parts.length,
        data: chunk,
        createdAt: now,
      }),
    ),
    db
      .delete(collabRelayBlobs)
      .where(and(eq(collabRelayBlobs.roomId, room.roomId), eq(collabRelayBlobs.kind, "u"), lte(collabRelayBlobs.seq, covers))),
    db.update(collabRelayRooms).set({ snapshotCovers: covers, updatedAt: now }).where(eq(collabRelayRooms.roomId, room.roomId)),
  ])
}

export async function postPresence(db: RelayDb, roomId: string, fromSid: string, data: string, now: number): Promise<void> {
  await batch(db, [
    db
      .delete(collabRelayPresence)
      .where(and(eq(collabRelayPresence.roomId, roomId), lt(collabRelayPresence.createdAt, now - PRESENCE_TTL_MS))),
    db.insert(collabRelayPresence).values({ roomId, fromSid, data, createdAt: now }),
  ])
}

export async function latestPresenceId(db: RelayDb, roomId: string): Promise<number> {
  const rows = await db
    .select({ id: sql<number | null>`max(${collabRelayPresence.id})` })
    .from(collabRelayPresence)
    .where(eq(collabRelayPresence.roomId, roomId))
  return Number(rows[0]?.id ?? 0)
}

/** What a room's live stream has missed since its cursors: one batch, so one D1 query per tick. */
export async function pollRoom(
  db: RelayDb,
  roomId: string,
  cursors: { seq: number; presenceId: number; sid: string },
): Promise<{
  updates: Array<{ seq: number; blob: string }>
  presence: Array<{ id: number; data: string }>
  ended: boolean
  gone: boolean
}> {
  const presenceWhere = cursors.sid
    ? and(eq(collabRelayPresence.roomId, roomId), gt(collabRelayPresence.id, cursors.presenceId), ne(collabRelayPresence.fromSid, cursors.sid))
    : and(eq(collabRelayPresence.roomId, roomId), gt(collabRelayPresence.id, cursors.presenceId))
  const [rows, presence, room] = (await batch(db, [
    updatesAfterQuery(db, roomId, cursors.seq, 50),
    db
      .select({ id: collabRelayPresence.id, data: collabRelayPresence.data })
      .from(collabRelayPresence)
      .where(presenceWhere)
      .orderBy(asc(collabRelayPresence.id))
      .limit(50),
    db
      .select({ endedAt: collabRelayRooms.endedAt })
      .from(collabRelayRooms)
      .where(eq(collabRelayRooms.roomId, roomId))
      .limit(1),
  ])) as [
    Array<{ seq: number; part: number; parts: number; data: string }>,
    Array<{ id: number; data: string }>,
    Array<{ endedAt: number | null }>,
  ]
  return {
    updates: joinParts(rows).blobs,
    presence,
    ended: room[0]?.endedAt != null,
    gone: room.length === 0,
  }
}

// ─── Card-sharing mailboxes ──────────────────────────────────────────

/**
 * Claims `recipient` for `userId` if nobody owns it yet, and says whether
 * `userId` owns it. A pairing code's mailbox belongs to the first account
 * that reads it: the cards inside are sealed to that browser's key anyway,
 * this just stops anyone else from reading or clearing the queue.
 */
export async function claimMailbox(db: RelayDb, recipient: string, userId: string, now: number): Promise<boolean> {
  await db.insert(collabRelayMailboxes).values({ recipient, userId, createdAt: now }).onConflictDoNothing()
  const rows = await db
    .select({ userId: collabRelayMailboxes.userId })
    .from(collabRelayMailboxes)
    .where(eq(collabRelayMailboxes.recipient, recipient))
    .limit(1)
  return rows[0]?.userId === userId
}

export async function postMessage(
  db: RelayDb,
  message: { msgId: string; recipient: string; senderId: string; body: string },
  now: number,
): Promise<void> {
  await batch(db, [
    db.delete(collabRelayMessages).where(lt(collabRelayMessages.createdAt, now - MESSAGE_TTL_MS)),
    db.insert(collabRelayMessages).values({ ...message, createdAt: now }),
  ])
}

export interface MailboxMessage {
  id: number
  msgId: string
  body: string
}

export async function listMessages(
  db: RelayDb,
  recipient: string,
  afterId: number,
  now: number,
  limit = 50,
): Promise<MailboxMessage[]> {
  return db
    .select({ id: collabRelayMessages.id, msgId: collabRelayMessages.msgId, body: collabRelayMessages.body })
    .from(collabRelayMessages)
    .where(
      and(
        eq(collabRelayMessages.recipient, recipient),
        gt(collabRelayMessages.id, afterId),
        gt(collabRelayMessages.createdAt, now - MESSAGE_TTL_MS),
      ),
    )
    .orderBy(asc(collabRelayMessages.id))
    .limit(limit)
}

export async function latestMessageId(db: RelayDb, recipient: string): Promise<number> {
  const rows = await db
    .select({ id: collabRelayMessages.id })
    .from(collabRelayMessages)
    .where(eq(collabRelayMessages.recipient, recipient))
    .orderBy(desc(collabRelayMessages.id))
    .limit(1)
  return rows[0]?.id ?? 0
}

/** Deletes a delivered card — only from a mailbox `userId` owns. */
export async function deleteMessage(db: RelayDb, msgId: string, userId: string): Promise<void> {
  const owned = db
    .select({ recipient: collabRelayMailboxes.recipient })
    .from(collabRelayMailboxes)
    .where(eq(collabRelayMailboxes.userId, userId))
  await db
    .delete(collabRelayMessages)
    .where(and(eq(collabRelayMessages.msgId, msgId), inArray(collabRelayMessages.recipient, owned)))
}
