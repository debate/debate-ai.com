import { NextResponse, type NextRequest } from "next/server";
import { getStaffAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { describeError } from "@/lib/database/errors";
import { listLibraryVideos } from "@/lib/videos/admin-library";

/**
 * Searchable listing of every *published* video, for the admin library table.
 *
 * Distinct from `/api/admin/youtube/videos`, which pages the resync queue of
 * rounds still waiting to be published. This one reads the public `videos`
 * table, so an admin can find and fix a video that already went live.
 *
 * Query parameters: `q`, `style`, `source`, `transcript` (`with` / `without`),
 * `sort`, `dir`, `page`, `limit`.
 */
export async function GET(req: NextRequest) {
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const styleParam = Number(searchParams.get("style"));

  try {
    const db = await getDBFromContext();
    const page = await listLibraryVideos(db, {
      q: searchParams.get("q"),
      style: searchParams.get("style") && Number.isFinite(styleParam) ? styleParam : null,
      source: searchParams.get("source"),
      transcript: searchParams.get("transcript"),
      sort: searchParams.get("sort"),
      dir: searchParams.get("dir") === "asc" ? "asc" : "desc",
      page: Number(searchParams.get("page")) || 1,
      limit: Number(searchParams.get("limit")) || undefined,
    });
    return NextResponse.json(page);
  } catch (error) {
    console.error("Failed to list library videos:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to load videos", details: describeError(error) },
      { status: 500 },
    );
  }
}
