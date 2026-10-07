/**
 * @fileoverview Reads and writes the next-season topic-area poll over the
 * `topic_area_rankings` table. A ballot is up to five rows (one per ranked
 * area) for one (season, user); casting a new ballot replaces the user's rows
 * for that season, so changing your mind never counts twice.
 *
 * @module lib/topic-area-poll/queries
 */

import { and, asc, eq } from "drizzle-orm";
import { pointsForRank, type TopicAreaPollResponse } from "@debate/videos/src/lib/topic-areas/topic-area-poll";

import type { getDBFromContext } from "@/lib/database/context";
import { topicAreaRankings } from "@/lib/database/schema";

type Db = Awaited<ReturnType<typeof getDBFromContext>>;

/** The Borda tally for `season`, plus `userId`'s ballot when there is a viewer. */
export async function getTopicAreaPoll(db: Db, season: number, userId: string | null): Promise<TopicAreaPollResponse> {
  const rows = await db
    .select({ userId: topicAreaRankings.userId, rank: topicAreaRankings.rank, area: topicAreaRankings.area })
    .from(topicAreaRankings)
    .where(eq(topicAreaRankings.season, season))
    .orderBy(asc(topicAreaRankings.rank));

  const points: Record<string, number> = {};
  const firstChoices: Record<string, number> = {};
  const voters = new Set<string>();
  const myRanking: string[] = [];
  for (const row of rows) {
    voters.add(row.userId);
    points[row.area] = (points[row.area] ?? 0) + pointsForRank(row.rank);
    if (row.rank === 1) firstChoices[row.area] = (firstChoices[row.area] ?? 0) + 1;
    if (userId !== null && row.userId === userId) myRanking.push(row.area);
  }

  return { season, points, firstChoices, total: voters.size, myRanking, signedIn: userId !== null };
}

/** Casts `userId`'s ranked ballot (best first), replacing any earlier ballot that season. */
export async function castTopicAreaVote(
  db: Db,
  { season, userId, ranking }: { season: number; userId: string; ranking: string[] },
): Promise<TopicAreaPollResponse> {
  const mine = and(eq(topicAreaRankings.season, season), eq(topicAreaRankings.userId, userId));
  const rows = ranking.map((area, i) => ({ season, userId, rank: i + 1, area }));
  // One batch, so the old ballot is never gone without the new one in place.
  await db.batch([db.delete(topicAreaRankings).where(mine), db.insert(topicAreaRankings).values(rows)]);
  return getTopicAreaPoll(db, season, userId);
}
