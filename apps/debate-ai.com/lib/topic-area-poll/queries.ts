/**
 * @fileoverview Reads and writes the next-season topic-area poll over the
 * `topic_area_votes` table. A vote is an upsert on (season, user), so changing
 * your mind replaces your row instead of counting twice.
 *
 * @module lib/topic-area-poll/queries
 */

import { and, eq, sql } from "drizzle-orm";
import type { TopicAreaPollResponse } from "@debate/videos/src/lib/topic-areas/topic-area-poll";

import type { getDBFromContext } from "@/lib/database/context";
import { topicAreaVotes } from "@/lib/database/schema";

type Db = Awaited<ReturnType<typeof getDBFromContext>>;

/** The tally for `season`, plus `userId`'s pick when there is a viewer. */
export async function getTopicAreaPoll(db: Db, season: number, userId: string | null): Promise<TopicAreaPollResponse> {
  const rows = await db
    .select({ area: topicAreaVotes.area, count: sql<number>`count(*)` })
    .from(topicAreaVotes)
    .where(eq(topicAreaVotes.season, season))
    .groupBy(topicAreaVotes.area);

  const counts: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    counts[row.area] = Number(row.count);
    total += Number(row.count);
  }

  let myVote: string | null = null;
  if (userId) {
    const [mine] = await db
      .select({ area: topicAreaVotes.area })
      .from(topicAreaVotes)
      .where(and(eq(topicAreaVotes.season, season), eq(topicAreaVotes.userId, userId)))
      .limit(1);
    myVote = mine?.area ?? null;
  }

  return { season, counts, total, myVote, signedIn: userId !== null };
}

/** Casts `userId`'s vote for `area`, replacing any earlier vote that season. */
export async function castTopicAreaVote(
  db: Db,
  { season, userId, area }: { season: number; userId: string; area: string },
): Promise<TopicAreaPollResponse> {
  await db
    .insert(topicAreaVotes)
    .values({ season, userId, area })
    .onConflictDoUpdate({
      target: [topicAreaVotes.season, topicAreaVotes.userId],
      set: { area, updatedAt: sql`(unixepoch())` },
    });
  return getTopicAreaPoll(db, season, userId);
}
