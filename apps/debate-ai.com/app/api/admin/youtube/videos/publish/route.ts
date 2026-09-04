import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { videos, youtubeRoundVideos } from "@/lib/database/schema";
import { publishedMsForDate, seasonYearForDate } from "debate-data-sync/src/videos/video-rows";

/** Adds every staged round to the public video grid. Video IDs are primary
 * keys, so this is safe to run repeatedly and cannot create duplicates. */
export async function POST() {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = await getDBFromContext();
  const rounds = await db.select().from(youtubeRoundVideos);
  let published = 0;
  for (const round of rounds) {
    const values = {
      videoId: round.id, source: "round" as const, title: round.title, publishedAt: round.publishedAt,
      publishedMs: publishedMsForDate(round.publishedAt), channel: round.channel,
      viewCount: round.views, description: round.description, style: round.style,
      category: null, categoryKey: null, tournament: round.tournament, roundLevel: round.roundLevel,
      affTeam: round.aff, negTeam: round.neg, affWin: round.winner, judgeDecision: round.judgeDecision,
      arg1ac: null, arg2nr: null, isTopPick: false, speechDocsUrl: null,
      seasonYear: seasonYearForDate(round.publishedAt),
      searchText: `${round.title} ${round.channel} ${round.description}`.toLowerCase(), updatedAt: new Date(),
    };
    await db.insert(videos).values(values).onConflictDoUpdate({ target: videos.videoId, set: values });
    published++;
  }
  return NextResponse.json({ published, message: `${published} round videos are available in the grid.` });
}
