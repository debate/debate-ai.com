import { NextResponse, type NextRequest } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { videos } from "@/lib/database/schema";
import { desc, eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

const YOUTUBE_WATCH = "https://www.youtube.com/watch?v=";
const YOUTUBE_THUMB = "https://i.ytimg.com/vi/";

/** Turn a stored publish date into a human "N days ago" string. */
function relativeTime(publishedAt: string): string {
  const published = new Date(publishedAt).getTime();
  const now = Date.now();
  const seconds = Math.floor((now - published) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

export async function GET(request: NextRequest) {
  const db = await getDBFromContext();
  const { searchParams } = new URL(request.url);
  const limitParam = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 10;

  let rows: Array<{ videoId: string; title: string; channel: string; publishedAt: string }> = [];
  try {
    rows = await db
      .select({
        videoId: videos.videoId,
        title: videos.title,
        channel: videos.channel,
        publishedAt: videos.publishedAt,
      })
      .from(videos)
      .where(and(eq(videos.availability, "available")))
      .orderBy(desc(videos.publishedMs))
      .limit(limit);
  } catch (error) {
    console.error("homepage: latest videos query failed", error);
    return NextResponse.json([]);
  }

  return NextResponse.json(
    rows.map((row) => ({
      id: row.videoId,
      title: row.title,
      channel: row.channel,
      thumbnail: `${YOUTUBE_THUMB}${row.videoId}/maxresdefault.jpg`,
      uploaded: relativeTime(row.publishedAt),
      watchUrl: `${YOUTUBE_WATCH}${row.videoId}`,
      duration: "",
    }))
  );
}
