/**
 * @fileoverview Reads and writes the next-season topic-area poll over the
 * `topic_area_rankings` table. A ballot is up to five rows (one per ranked
 * area) for one (season, user), each carrying the format the voter debates;
 * casting a new ballot replaces the user's rows for that season, so changing
 * your mind never counts twice.
 *
 * Area names saved before the areas were rebalanced are read through
 * `currentAreaName`, so old ballots still count under the area they became.
 *
 * @module lib/topic-area-poll/queries
 */

import { and, asc, eq } from "drizzle-orm";
import {
  currentAreaName,
  isPollFormat,
  pointsForRank,
  type TopicAreaPollResponse,
  type TopicAreaPollTally,
} from "@debate-ai/videos/src/lib/topic-areas/topic-area-poll";
import type { TopicFormat } from "@debate-ai/videos/src/lib/topic-areas/topic-areas";

import type { getDBFromContext } from "@/lib/database/context";
import { topicAreaRankings } from "@/lib/database/schema";

type Db = Awaited<ReturnType<typeof getDBFromContext>>;

interface BallotRow {
  userId: string;
  rank: number;
  area: string;
  format: string | null;
}

/**
 * True for the error D1/SQLite raises when `topic_area_rankings.format` has
 * not been added yet (its migration lands with the deploy), so the poll keeps
 * working, unsplit, until it has.
 */
function isMissingFormatColumn(error: unknown): boolean {
  const text = `${String(error)} ${String((error as { cause?: unknown })?.cause ?? "")}`;
  return /no such column:?\s*"?format|has no column named format/i.test(text);
}

async function readBallots(db: Db, season: number): Promise<BallotRow[]> {
  try {
    return await db
      .select({
        userId: topicAreaRankings.userId,
        rank: topicAreaRankings.rank,
        area: topicAreaRankings.area,
        format: topicAreaRankings.format,
      })
      .from(topicAreaRankings)
      .where(eq(topicAreaRankings.season, season))
      .orderBy(asc(topicAreaRankings.rank));
  } catch (error) {
    if (!isMissingFormatColumn(error)) throw error;
    const rows = await db
      .select({ userId: topicAreaRankings.userId, rank: topicAreaRankings.rank, area: topicAreaRankings.area })
      .from(topicAreaRankings)
      .where(eq(topicAreaRankings.season, season))
      .orderBy(asc(topicAreaRankings.rank));
    return rows.map((row: Omit<BallotRow, "format">) => ({ ...row, format: null }));
  }
}

function emptyTally(): TopicAreaPollTally {
  return { points: {}, firstChoices: {}, total: 0 };
}

/** The Borda tally for `season`, overall and per format, plus `userId`'s ballot when there is a viewer. */
export async function getTopicAreaPoll(db: Db, season: number, userId: string | null): Promise<TopicAreaPollResponse> {
  const rows = await readBallots(db, season);

  // Group into ballots, best first, with legacy area names mapped forward and
  // any area a rename made appear twice kept at its better rank only.
  const ballots = new Map<string, { format: TopicFormat | null; ranking: string[] }>();
  for (const row of rows) {
    const ballot = ballots.get(row.userId) ?? { format: null, ranking: [] };
    if (isPollFormat(row.format)) ballot.format = row.format;
    const area = currentAreaName(row.area);
    if (!ballot.ranking.includes(area)) ballot.ranking.push(area);
    ballots.set(row.userId, ballot);
  }

  const overall = emptyTally();
  const byFormat: TopicAreaPollResponse["byFormat"] = {};
  const add = (tally: TopicAreaPollTally, ranking: string[]) => {
    tally.total++;
    ranking.forEach((area, i) => {
      tally.points[area] = (tally.points[area] ?? 0) + pointsForRank(i + 1);
      if (i === 0) tally.firstChoices[area] = (tally.firstChoices[area] ?? 0) + 1;
    });
  };
  for (const { format, ranking } of ballots.values()) {
    add(overall, ranking);
    if (format) add((byFormat[format] ??= emptyTally()), ranking);
  }

  const mine = userId !== null ? ballots.get(userId) : undefined;
  return {
    season,
    ...overall,
    byFormat,
    myRanking: mine?.ranking ?? [],
    myFormat: mine?.format ?? null,
    signedIn: userId !== null,
  };
}

/** Casts `userId`'s ranked ballot (best first), replacing any earlier ballot that season. */
export async function castTopicAreaVote(
  db: Db,
  { season, userId, format, ranking }: { season: number; userId: string; format: TopicFormat; ranking: string[] },
): Promise<TopicAreaPollResponse> {
  const mine = and(eq(topicAreaRankings.season, season), eq(topicAreaRankings.userId, userId));
  const rows = ranking.map((area, i) => ({ season, userId, rank: i + 1, area, format }));
  // One batch, so the old ballot is never gone without the new one in place.
  try {
    await db.batch([db.delete(topicAreaRankings).where(mine), db.insert(topicAreaRankings).values(rows)]);
  } catch (error) {
    if (!isMissingFormatColumn(error)) throw error;
    const unsplit = rows.map(({ format: _format, ...row }) => row);
    await db.batch([db.delete(topicAreaRankings).where(mine), db.insert(topicAreaRankings).values(unsplit)]);
  }
  return getTopicAreaPoll(db, season, userId);
}
