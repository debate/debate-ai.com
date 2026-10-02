/**
 * @fileoverview The read and write side of Practice Partners, over the
 * `practice_profiles` and `practice_challenges` tables in
 * `lib/database/schema.ts`.
 *
 * ## Who can see whom
 *
 * The board is account-only (the routes 401 without a session): it lists real
 * people, many of them students, who asked to be contacted, and "asked to be
 * contacted by other members" is not "asked to be listed on the open web".
 * Anonymous guest accounts are never listed and cannot volunteer, and a block
 * in either direction (`user_blocks`, from Contacts) hides each person from
 * the other's board and refuses a challenge between them — the same rule
 * Contacts applies to requests.
 *
 * ## Why people are hydrated separately
 *
 * A challenge names up to three accounts. Rather than joining `user` three
 * times under aliases, a read collects every id on the page and fetches their
 * public fields in one `IN` query — one extra round trip, and one place that
 * decides which user columns leave the server (never the email).
 *
 * @module lib/practice-partners/queries
 */

import { and, desc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import type {
  ChallengeStatus,
  JudgeStatus,
  PracticeChallenge,
  PracticeFormat,
  PracticePerson,
  PracticeProfileInput,
  PracticeVolunteer,
} from "@debate/webview/lib/practice-partners/types";
import type { ChallengeState } from "@debate/webview/lib/practice-partners/challenge-actions";

import type { getDBFromContext } from "@/lib/database/context";
import { notifications, practiceChallenges, practiceProfiles, user, userBlocks } from "@/lib/database/schema";
import { readStoredPreferences, roomIdForChallenge, storedPreferences, type ParsedChallenge } from "@debate/webview/lib/practice-partners/validation";

type Db = Awaited<ReturnType<typeof getDBFromContext>>;

/** Where every Practice Partners notification sends its reader. */
export const PRACTICE_PARTNERS_LINK = "/practice/partners";

/** The most volunteers one board read returns. */
const VOLUNTEER_LIMIT = 200;
/** The most of the viewer's own challenges one board read returns. */
const CHALLENGE_LIMIT = 100;
/** The most unjudged rounds one board read offers a judge. */
const OPEN_TO_JUDGE_LIMIT = 50;
/**
 * How long after its proposed start an unjudged round stays on offer to
 * judges. A round proposed for last night is not going to need one now.
 */
const OPEN_TO_JUDGE_GRACE_SECONDS = 3 * 60 * 60;

function toWireTime(value: Date): number {
  return Math.floor(value.getTime() / 1000);
}

/** Every account with a block against or from `viewerId`. */
export async function loadBlockedIds(db: Db, viewerId: string): Promise<Set<string>> {
  const rows: { blockerId: string; blockedId: string }[] = await db
    .select({ blockerId: userBlocks.blockerId, blockedId: userBlocks.blockedId })
    .from(userBlocks)
    .where(or(eq(userBlocks.blockerId, viewerId), eq(userBlocks.blockedId, viewerId)));
  return new Set(rows.map((row) => (row.blockerId === viewerId ? row.blockedId : row.blockerId)));
}

/** The public fields of every id given, keyed by id. Unknown ids are simply absent. */
async function hydratePeople(db: Db, ids: Iterable<string>): Promise<Map<string, PracticePerson>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows: { id: string; name: string; image: string | null }[] = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(user)
    .where(inArray(user.id, unique));
  return new Map(rows.map((row) => [row.id, { id: row.id, name: row.name, imageUrl: row.image ?? null }]));
}

/** The viewer's public fields and whether they are a guest account, or `null` if the row is gone. */
export async function getViewer(
  db: Db,
  viewerId: string,
): Promise<(PracticePerson & { isAnonymous: boolean }) | null> {
  const [row] = await db
    .select({ id: user.id, name: user.name, image: user.image, isAnonymous: user.isAnonymous })
    .from(user)
    .where(eq(user.id, viewerId))
    .limit(1);
  if (!row) return null;
  return { id: row.id, name: row.name, imageUrl: row.image ?? null, isAnonymous: Boolean(row.isAnonymous) };
}

type ProfileRow = { asCompetitor: boolean; asJudge: boolean; preferences: string };

function toProfile(row: ProfileRow): PracticeProfileInput {
  return { asCompetitor: Boolean(row.asCompetitor), asJudge: Boolean(row.asJudge), ...readStoredPreferences(row.preferences) };
}

/** One account's practice profile, or `null` before they have saved one. */
export async function getProfile(db: Db, userId: string): Promise<PracticeProfileInput | null> {
  const [row] = await db
    .select({ asCompetitor: practiceProfiles.asCompetitor, asJudge: practiceProfiles.asJudge, preferences: practiceProfiles.preferences })
    .from(practiceProfiles)
    .where(eq(practiceProfiles.userId, userId))
    .limit(1);
  return row ? toProfile(row) : null;
}

/** Writes the viewer's profile, replacing any earlier one. */
export async function upsertProfile(db: Db, userId: string, profile: PracticeProfileInput): Promise<void> {
  const now = new Date();
  const values = {
    asCompetitor: profile.asCompetitor,
    asJudge: profile.asJudge,
    preferences: storedPreferences(profile),
    updatedAt: now,
  };
  await db
    .insert(practiceProfiles)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: practiceProfiles.userId, set: values });
}

/** Everyone else volunteering in at least one role, minus blocks and guests, most recently updated first. */
export async function listVolunteers(db: Db, viewerId: string, blocked: Set<string>): Promise<PracticeVolunteer[]> {
  const rows: (ProfileRow & { updatedAt: Date; id: string; name: string; image: string | null })[] = await db
    .select({
      asCompetitor: practiceProfiles.asCompetitor,
      asJudge: practiceProfiles.asJudge,
      preferences: practiceProfiles.preferences,
      updatedAt: practiceProfiles.updatedAt,
      id: user.id,
      name: user.name,
      image: user.image,
    })
    .from(practiceProfiles)
    .innerJoin(user, eq(practiceProfiles.userId, user.id))
    .where(
      and(
        or(eq(practiceProfiles.asCompetitor, true), eq(practiceProfiles.asJudge, true)),
        ne(practiceProfiles.userId, viewerId),
        eq(user.isAnonymous, false),
      ),
    )
    .orderBy(desc(practiceProfiles.updatedAt))
    .limit(VOLUNTEER_LIMIT);

  return rows
    .filter((row) => !blocked.has(row.id))
    .map((row) => ({
      ...toProfile(row),
      person: { id: row.id, name: row.name, imageUrl: row.image ?? null },
      updatedAt: toWireTime(row.updatedAt),
    }));
}

type ChallengeRow = typeof practiceChallenges.$inferSelect;

/** Rows to the wire shape, dropping any whose debaters no longer exist. */
async function toWireChallenges(db: Db, rows: ChallengeRow[]): Promise<PracticeChallenge[]> {
  const people = await hydratePeople(
    db,
    rows.flatMap((row) => [row.challengerId, row.opponentId, ...(row.judgeId ? [row.judgeId] : [])]),
  );
  const out: PracticeChallenge[] = [];
  for (const row of rows) {
    const challenger = people.get(row.challengerId);
    const opponent = people.get(row.opponentId);
    if (!challenger || !opponent) continue;
    const judge = row.judgeId ? people.get(row.judgeId) ?? null : null;
    out.push({
      id: row.id,
      status: row.status as ChallengeStatus,
      challenger,
      opponent,
      judge,
      judgeStatus: judge ? (row.judgeStatus as JudgeStatus) : null,
      format: row.format as PracticeFormat,
      topic: row.topic,
      message: row.message,
      proposedAt: row.proposedAt ? toWireTime(row.proposedAt) : null,
      roomId: row.roomId,
      createdAt: toWireTime(row.createdAt),
      updatedAt: toWireTime(row.updatedAt),
    });
  }
  return out;
}

/** Every challenge the viewer is in, as challenger, opponent or judge, newest first. */
export async function listChallengesFor(db: Db, viewerId: string): Promise<PracticeChallenge[]> {
  const rows: ChallengeRow[] = await db
    .select()
    .from(practiceChallenges)
    .where(
      or(
        eq(practiceChallenges.challengerId, viewerId),
        eq(practiceChallenges.opponentId, viewerId),
        eq(practiceChallenges.judgeId, viewerId),
      ),
    )
    .orderBy(desc(practiceChallenges.createdAt))
    .limit(CHALLENGE_LIMIT);
  return toWireChallenges(db, rows);
}

/**
 * Accepted rounds with an empty judge seat that the viewer could pick up:
 * not their own, not with anyone they have a block with, and not already long
 * past their proposed start.
 */
export async function listOpenToJudge(
  db: Db,
  viewerId: string,
  blocked: Set<string>,
  nowSeconds: number,
): Promise<PracticeChallenge[]> {
  const rows: ChallengeRow[] = await db
    .select()
    .from(practiceChallenges)
    .where(
      and(
        eq(practiceChallenges.status, "accepted"),
        isNull(practiceChallenges.judgeId),
        ne(practiceChallenges.challengerId, viewerId),
        ne(practiceChallenges.opponentId, viewerId),
      ),
    )
    .orderBy(desc(practiceChallenges.createdAt))
    .limit(OPEN_TO_JUDGE_LIMIT * 2);

  const cutoff = nowSeconds - OPEN_TO_JUDGE_GRACE_SECONDS;
  const visible = rows
    .filter((row) => !blocked.has(row.challengerId) && !blocked.has(row.opponentId))
    .filter((row) => !row.proposedAt || toWireTime(row.proposedAt) >= cutoff)
    .slice(0, OPEN_TO_JUDGE_LIMIT);
  return toWireChallenges(db, visible);
}

/** How many of the viewer's challenges are waiting on an answer. */
export async function countPendingOutgoing(db: Db, viewerId: string): Promise<number> {
  const rows: { id: string }[] = await db
    .select({ id: practiceChallenges.id })
    .from(practiceChallenges)
    .where(and(eq(practiceChallenges.challengerId, viewerId), eq(practiceChallenges.status, "pending")));
  return rows.length;
}

/** Whether the viewer already has a challenge waiting on this opponent. */
export async function hasPendingChallenge(db: Db, challengerId: string, opponentId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: practiceChallenges.id })
    .from(practiceChallenges)
    .where(
      and(
        eq(practiceChallenges.challengerId, challengerId),
        eq(practiceChallenges.opponentId, opponentId),
        eq(practiceChallenges.status, "pending"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** One challenge as stored, or `null`. */
export async function getChallengeRow(db: Db, id: string): Promise<ChallengeRow | null> {
  const [row] = await db.select().from(practiceChallenges).where(eq(practiceChallenges.id, id)).limit(1);
  return row ?? null;
}

/** One challenge in the wire shape, or `null`. */
export async function getChallenge(db: Db, id: string): Promise<PracticeChallenge | null> {
  const row = await getChallengeRow(db, id);
  if (!row) return null;
  const [wire] = await toWireChallenges(db, [row]);
  return wire ?? null;
}

/** The parts of a stored row the action rules read. */
export function rowState(row: ChallengeRow): ChallengeState {
  return {
    status: row.status as ChallengeStatus,
    challengerId: row.challengerId,
    opponentId: row.opponentId,
    judgeId: row.judgeId ?? null,
    judgeStatus: row.judgeId ? (row.judgeStatus as JudgeStatus) : null,
  };
}

/** Writes a new challenge and reads it back. */
export async function insertChallenge(
  db: Db,
  { id, challengerId, challenge }: { id: string; challengerId: string; challenge: ParsedChallenge },
): Promise<PracticeChallenge> {
  const now = new Date();
  await db.insert(practiceChallenges).values({
    id,
    challengerId,
    opponentId: challenge.opponentId,
    judgeId: challenge.judgeId,
    judgeStatus: challenge.judgeId ? "invited" : null,
    status: "pending",
    format: challenge.format,
    topic: challenge.topic,
    message: challenge.message,
    proposedAt: challenge.proposedAt === null ? null : new Date(challenge.proposedAt * 1000),
    roomId: roomIdForChallenge(id),
    createdAt: now,
    updatedAt: now,
  });
  const created = await getChallenge(db, id);
  if (!created) throw new Error("The challenge could not be saved.");
  return created;
}

/**
 * Writes the state an action produced — guarded on the state it was computed
 * from, so two people acting at once cannot both win (a judge picking up a
 * round the same second another does). Returns whether the write landed.
 */
export async function updateChallengeState(
  db: Db,
  id: string,
  from: ChallengeState,
  next: ChallengeState,
): Promise<boolean> {
  const result = await db
    .update(practiceChallenges)
    .set({ status: next.status, judgeId: next.judgeId, judgeStatus: next.judgeStatus, updatedAt: new Date() })
    .where(
      and(
        eq(practiceChallenges.id, id),
        eq(practiceChallenges.status, from.status),
        from.judgeId === null ? isNull(practiceChallenges.judgeId) : eq(practiceChallenges.judgeId, from.judgeId),
      ),
    )
    .returning({ id: practiceChallenges.id });
  return result.length > 0;
}

/** One notification row per recipient, all pointing at the practice board. */
export async function notifyPracticePartners(
  db: Db,
  recipients: string[],
  { title, body }: { title: string; body: string },
): Promise<void> {
  if (recipients.length === 0) return;
  const now = new Date();
  await db.insert(notifications).values(
    recipients.map((userId) => ({
      userId,
      type: "practice_challenge",
      title,
      body,
      link: PRACTICE_PARTNERS_LINK,
      createdAt: now,
    })),
  );
}
