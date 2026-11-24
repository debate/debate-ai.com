import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getStaffAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { ensureRoundVideosTable } from "@/lib/youtube/round-videos-table";
import { videos, youtubeRoundVideos } from "@/lib/database/schema";
import { normalizeCategoryKey, publishedMsForDate, seasonYearForDate, stripTournamentYear } from "@debate-ai/videos/src/data/video-rows";
import { classifyRoundCollection, isLectureCategory, lectureCategoryForChannel } from "@debate-ai/videos/src/data/lecture-classifier";
import { parseQueuedRoundArgs } from "@debate-ai/videos-admin/src/sync/youtube/parsers/round-arguments";
import { recomputeVideoStacks } from "@/lib/videos/recompute-video-stacks";

/** Adds every staged round or lecture to the public video grid. Video IDs are
 * primary keys, so this is safe to run repeatedly and cannot create duplicates;
 * a round already in the grid keeps its existing (older) row. */
export async function POST() {
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = await getDBFromContext();
  await ensureRoundVideosTable(db);
  const queued = await db.select().from(youtubeRoundVideos);
  let published = 0;
  for (const round of queued) {
    const isLecture = round.style == null;
    const category = isLecture
      ? (lectureCategoryForChannel(round.channel) ?? (isLectureCategory(round.category) ? round.category : null))
      : classifyRoundCollection(round.title);
    const values = {
      videoId: round.id,
      source: (isLecture ? "lecture" : "round") as "lecture" | "round",
      title: round.title,
      publishedAt: round.publishedAt,
      publishedMs: publishedMsForDate(round.publishedAt),
      channel: round.channel,
      viewCount: round.views,
      description: round.description,
      style: round.style,
      category,
      categoryKey: category ? normalizeCategoryKey(category) : null,
      tournament: stripTournamentYear(round.tournament),
      roundLevel: round.roundLevel,
      affTeam: round.aff,
      negTeam: round.neg,
      affWin: round.winner,
      judgeDecision: round.judgeDecision,
      ...parseQueuedRoundArgs(round.description),
      isTopPick: false,
      speechDocsUrl: null,
      seasonYear: seasonYearForDate(round.publishedAt),
      searchText: `${round.title} ${round.channel} ${round.description}`.toLowerCase(),
      updatedAt: new Date(),
    };
    const inserted = await db.insert(videos).values(values).onConflictDoNothing().returning({ videoId: videos.videoId });
    if (inserted.length > 0) published++;
  }
  // This endpoint builds its own row values instead of going through
  // `publishRoundVideos` (see that function's docstring), so it needs its
  // own call to re-derive stacking — a newly published round otherwise
  // never links up with an analysis already in the table. See
  // `recompute-video-stacks.ts`'s fileoverview.
  if (published > 0) await recomputeVideoStacks(db);
  return NextResponse.json({ published, message: `${published} videos are available in the grid.` });
}
