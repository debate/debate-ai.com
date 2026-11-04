/**
 * @fileoverview The read and write side of the Judge Pool, over the
 * `judge_pool_listings` and `judge_hire_requests` tables in
 * `lib/database/schema.ts`.
 *
 * ## Who can see whom
 *
 * The pool is account-only, like the practice board: the routes 401 without a
 * session. Unlike practice partners, judges are listed by name — an organizer
 * hiring a judge needs to know who they are hiring, and a judge who lists
 * themselves is asking to be found. Guests can't list themselves or hire, and
 * a block from Contacts in either direction hides each person from the other
 * and refuses a request between them.
 *
 * @module lib/judge-pool/queries
 */

import { and, desc, eq, inArray, ne, or } from "drizzle-orm";
import type { PracticePerson } from "@debate-ai/practice-rounds/src/practice-partners/types";
import {
  US_STATES,
  type HireStatus,
  type JudgeHireRequest,
  type JudgeListingInput,
  type JudgePoolEntry,
  type NewHireRequest,
  type UsState,
} from "@debate-ai/practice-rounds/src/judge-pool/types";
import { isUpcomingWeekend, isSeasonWeekend, weekendLabel } from "@debate-ai/practice-rounds/src/judge-pool/season-calendar";
import { isPracticeFormatId, isUsState, readStoredList, type HireState } from "@debate-ai/practice-rounds/src/judge-pool/validation";

import type { getDBFromContext } from "@/lib/database/context";
import { judgeHireRequests, judgePoolListings, notifications, user } from "@/lib/database/schema";

type Db = Awaited<ReturnType<typeof getDBFromContext>>;

/** Where every hire-request notification sends its reader. */
export const JUDGE_POOL_LINK = "/practice/prep?section=partners#judge-pool";

/** The most listings one pool read considers. */
const POOL_LIMIT = 200;
/** The most of the viewer's own hire requests one read returns. */
const HIRE_LIMIT = 100;

const toWireTime = (value: Date) => Math.floor(value.getTime() / 1000);

type ListingRow = {
  active: boolean;
  weekends: string;
  states: string;
  canTravel: boolean;
  formats: string;
  philosophy: string;
};

const listingColumns = {
  active: judgePoolListings.active,
  weekends: judgePoolListings.weekends,
  states: judgePoolListings.states,
  canTravel: judgePoolListings.canTravel,
  formats: judgePoolListings.formats,
  philosophy: judgePoolListings.philosophy,
};

/** A stored listing in wire shape, with weekends that have passed on `today` dropped. */
function toListing(row: ListingRow, today: string): JudgeListingInput {
  const stateOrder = new Map<string, number>(US_STATES.map((state, index) => [state.id, index]));
  return {
    active: Boolean(row.active),
    weekends: readStoredList(row.weekends, isSeasonWeekend)
      .filter((key) => isUpcomingWeekend(key, today))
      .sort(),
    states: readStoredList<UsState>(row.states, isUsState).sort((a, b) => stateOrder.get(a)! - stateOrder.get(b)!),
    canTravel: Boolean(row.canTravel),
    formats: readStoredList(row.formats, isPracticeFormatId),
    philosophy: row.philosophy ?? "",
  };
}

/** The viewer's own listing, or `null` before they have saved one. */
export async function getListing(db: Db, userId: string, today: string): Promise<JudgeListingInput | null> {
  const [row] = await db.select(listingColumns).from(judgePoolListings).where(eq(judgePoolListings.userId, userId)).limit(1);
  return row ? toListing(row, today) : null;
}

/** Writes the viewer's listing, replacing any earlier one. */
export async function upsertListing(db: Db, userId: string, listing: JudgeListingInput): Promise<void> {
  const values = {
    active: listing.active,
    weekends: JSON.stringify(listing.weekends),
    states: JSON.stringify(listing.states),
    canTravel: listing.canTravel,
    formats: JSON.stringify(listing.formats),
    philosophy: listing.philosophy,
    updatedAt: new Date(),
  };
  await db
    .insert(judgePoolListings)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: judgePoolListings.userId, set: values });
}

/**
 * Every other active listing with at least one weekend still ahead, minus
 * blocks and guests, most recently updated first.
 */
export async function listPool(db: Db, viewerId: string, blocked: Set<string>, today: string): Promise<JudgePoolEntry[]> {
  const rows: (ListingRow & { updatedAt: Date; id: string; name: string; image: string | null })[] = await db
    .select({ ...listingColumns, updatedAt: judgePoolListings.updatedAt, id: user.id, name: user.name, image: user.image })
    .from(judgePoolListings)
    .innerJoin(user, eq(judgePoolListings.userId, user.id))
    .where(and(eq(judgePoolListings.active, true), ne(judgePoolListings.userId, viewerId), eq(user.isAnonymous, false)))
    .orderBy(desc(judgePoolListings.updatedAt))
    .limit(POOL_LIMIT);
  return rows
    .filter((row) => !blocked.has(row.id))
    .map((row) => ({
      ...toListing(row, today),
      judge: { id: row.id, name: row.name, imageUrl: row.image ?? null },
      updatedAt: toWireTime(row.updatedAt),
    }))
    .filter((entry) => entry.weekends.length > 0);
}

/** One judge's active listing as the pool would show it, or `null`. */
export async function getActiveListing(db: Db, judgeId: string, today: string): Promise<JudgeListingInput | null> {
  const [row] = await db
    .select(listingColumns)
    .from(judgePoolListings)
    .innerJoin(user, eq(judgePoolListings.userId, user.id))
    .where(and(eq(judgePoolListings.userId, judgeId), eq(judgePoolListings.active, true), eq(user.isAnonymous, false)))
    .limit(1);
  return row ? toListing(row, today) : null;
}

async function hydratePeople(db: Db, ids: Iterable<string>): Promise<Map<string, PracticePerson>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows: { id: string; name: string; image: string | null }[] = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(user)
    .where(inArray(user.id, unique));
  return new Map(rows.map((row) => [row.id, { id: row.id, name: row.name, imageUrl: row.image ?? null }]));
}

type HireRow = typeof judgeHireRequests.$inferSelect;

const MISSING_PERSON: PracticePerson = { id: "", name: "Deleted account", imageUrl: null };

async function toWireHires(db: Db, rows: HireRow[]): Promise<JudgeHireRequest[]> {
  const people = await hydratePeople(db, rows.flatMap((row) => [row.organizerId, row.judgeId]));
  return rows.map((row) => ({
    id: row.id,
    status: row.status as HireStatus,
    organizer: people.get(row.organizerId) ?? MISSING_PERSON,
    judge: people.get(row.judgeId) ?? MISSING_PERSON,
    tournamentName: row.tournamentName,
    weekend: row.weekend,
    offer: row.offer,
    message: row.message,
    createdAt: toWireTime(row.createdAt),
    updatedAt: toWireTime(row.updatedAt),
  }));
}

/** Every hire request the viewer sent or received, newest first. */
export async function listHiresFor(db: Db, viewerId: string): Promise<JudgeHireRequest[]> {
  const rows = await db
    .select()
    .from(judgeHireRequests)
    .where(or(eq(judgeHireRequests.organizerId, viewerId), eq(judgeHireRequests.judgeId, viewerId)))
    .orderBy(desc(judgeHireRequests.createdAt))
    .limit(HIRE_LIMIT);
  return toWireHires(db, rows);
}

/** One hire request in wire shape, or `null`. */
export async function getHire(db: Db, id: string): Promise<(JudgeHireRequest & HireState) | null> {
  const [row] = await db.select().from(judgeHireRequests).where(eq(judgeHireRequests.id, id)).limit(1);
  if (!row) return null;
  const [wire] = await toWireHires(db, [row]);
  return { ...wire, organizerId: row.organizerId, judgeId: row.judgeId };
}

/** How many of the organizer's requests are still waiting on an answer. */
export async function countPendingSent(db: Db, organizerId: string): Promise<number> {
  const rows = await db
    .select({ id: judgeHireRequests.id })
    .from(judgeHireRequests)
    .where(and(eq(judgeHireRequests.organizerId, organizerId), eq(judgeHireRequests.status, "pending")));
  return rows.length;
}

/** Whether the organizer already has an open (pending or accepted) request to this judge for this weekend. */
export async function hasOpenRequest(db: Db, organizerId: string, judgeId: string, weekend: string): Promise<boolean> {
  const rows = await db
    .select({ id: judgeHireRequests.id })
    .from(judgeHireRequests)
    .where(
      and(
        eq(judgeHireRequests.organizerId, organizerId),
        eq(judgeHireRequests.judgeId, judgeId),
        eq(judgeHireRequests.weekend, weekend),
        inArray(judgeHireRequests.status, ["pending", "accepted"]),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Stores a new hire request and returns its id. */
export async function insertHire(db: Db, organizerId: string, request: NewHireRequest): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(judgeHireRequests).values({
    id,
    organizerId,
    judgeId: request.judgeId,
    tournamentName: request.tournamentName,
    weekend: request.weekend,
    offer: request.offer,
    message: request.message,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

/**
 * Moves a request to `next` only if it is still `from` — so a judge accepting
 * just as the organizer cancels can't both land. Returns whether it moved.
 */
export async function transitionHire(db: Db, id: string, from: HireStatus, next: HireStatus): Promise<boolean> {
  const result = await db
    .update(judgeHireRequests)
    .set({ status: next, updatedAt: new Date() })
    .where(and(eq(judgeHireRequests.id, id), eq(judgeHireRequests.status, from)))
    .returning({ id: judgeHireRequests.id });
  return result.length > 0;
}

/** One `judge_hire` notification, pointing at the judge pool. */
export async function notifyJudgePool(db: Db, userId: string, { title, body }: { title: string; body: string }): Promise<void> {
  await db.insert(notifications).values({ userId, type: "judge_hire", title, body, link: JUDGE_POOL_LINK, createdAt: new Date() });
}

/** "Bay Area Invitational, Week F · Oct 17–18" — how a request is named in a notification. */
export function describeHire(request: { tournamentName: string; weekend: string }): string {
  return `${request.tournamentName}, ${weekendLabel(request.weekend)}`;
}
