import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDBFromContext } from "@/lib/database/context";
import { ensureTableColumns } from "@/lib/database/ensure-columns";
import { videos } from "@/lib/database/schema";

/**
 * The judges of one round and which of them squirreled, for the watch page's
 * "Reveal decision". They are saved by the college results lookup (the edit
 * dialog's "Use this result" and the admin bulk fill) and are not part of the
 * compact feed tuples, so the watch page asks for them only once the viewer
 * reveals the decision.
 *
 * Query parameters:
 * - `id` — the YouTube video id
 *
 * Responds `{ judges: string | null, squirrels: string | null }`:
 * comma-separated names; squirrels `""` for a unanimous decision and null
 * when unknown.
 */
export async function GET(request: NextRequest) {
  const id = (new URL(request.url).searchParams.get("id") ?? "").trim().slice(0, 64);
  if (!id) return NextResponse.json({ judges: null, squirrels: null });

  try {
    const db = await getDBFromContext();
    await ensureTableColumns(db, videos).catch(() => undefined);
    const [row] = await db
      .select({ judges: videos.resultsJudges, squirrels: videos.resultsSquirrels })
      .from(videos)
      .where(eq(videos.videoId, id))
      .limit(1);
    return NextResponse.json(
      { judges: row?.judges ?? null, squirrels: row?.squirrels ?? null },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
    );
  } catch (error) {
    console.error("Failed to load round judges", error);
    return NextResponse.json({ error: "Failed to load round judges" }, { status: 500 });
  }
}
