import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDBFromContext } from "@/lib/database/context";
import { ensureTableColumns } from "@/lib/database/ensure-columns";
import { videos } from "@/lib/database/schema";
import { tabroomFetch } from "@/lib/judge-paradigms/tabroom";
import { cacheDecision, cachedDecision, liveDecisionLookup, resolveRoundDecision } from "@/lib/videos/round-decision";
import { UNKNOWN_DECISION, type RoundDecision } from "@debate-ai/videos/src/lib/round-decision";

/**
 * One round's decision and judges for the watch page's "Reveal decision"
 * button (every round video has one, stored decision or not). The page asks
 * only after the viewer clicks, so no winner is ever sent before then.
 *
 * Query parameters:
 * - `id` — the YouTube video id
 *
 * Responds with a `RoundDecision` (`@debate-ai/videos/src/lib/round-decision`):
 * the stored decision when the video has one, else a live lookup on College
 * Debate Results (college) or Tabroom (Policy / PF / LD / Parliamentary),
 * else `{ status: "unknown" }`. Unknown is a normal answer, not an error;
 * only an unreachable database is a 500. Nothing is written to the database;
 * answers are cached per instance and by the CDN.
 */
export async function GET(request: NextRequest) {
  const id = (new URL(request.url).searchParams.get("id") ?? "").trim().slice(0, 64);
  if (!id) return NextResponse.json(UNKNOWN_DECISION);

  const cached = cachedDecision(id);
  if (cached) return respond(cached, true);

  try {
    const db = await getDBFromContext();
    await ensureTableColumns(db, videos).catch(() => undefined);
    const [row] = await db
      .select({
        style: videos.style,
        source: videos.source,
        tournament: videos.tournament,
        roundLevel: videos.roundLevel,
        affTeam: videos.affTeam,
        negTeam: videos.negTeam,
        seasonYear: videos.seasonYear,
        publishedAt: videos.publishedAt,
        affWin: videos.affWin,
        judgeDecision: videos.judgeDecision,
        resultsJudges: videos.resultsJudges,
        resultsSquirrels: videos.resultsSquirrels,
      })
      .from(videos)
      .where(eq(videos.videoId, id))
      .limit(1);
    if (!row) return respond(UNKNOWN_DECISION, true);

    const { decision, settled } = await resolveRoundDecision(
      { ...row, seasonYear: row.seasonYear || null },
      liveDecisionLookup({ tabroomFetch: () => tabroomFetch() as never }),
    );
    if (settled) cacheDecision(id, decision);
    return respond(decision, settled);
  } catch (error) {
    console.error("Failed to load round decision", error);
    return NextResponse.json({ error: "Failed to load round decision" }, { status: 500 });
  }
}

function respond(decision: RoundDecision, cacheable: boolean) {
  const headers = {
    "Cache-Control": !cacheable
      ? "no-store"
      : decision.status === "known"
        ? "public, max-age=300, s-maxage=86400, stale-while-revalidate=3600"
        : "public, max-age=60, s-maxage=3600",
  };
  return NextResponse.json(decision, { headers });
}
