import { NextResponse, type NextRequest } from "next/server";
import { latestOutlineFiles } from "@debate-ai/reason-docs/lib/topic-starters/latest-files";
import { getDBFromContext } from "@/lib/database/context";
import { ensureTopicStarterColumns } from "@/lib/topic-starters/changes";
import { getTopicStarterFileIndex } from "@/lib/topic-starters/file-index";

/**
 * @fileoverview The homepage's "Latest outline files" marquee: the newest
 * published Topic Starter files, interleaved across debate formats
 * (`@debate-ai/reason-docs/lib/topic-starters/latest-files`).
 *
 * Read from the stored names-only file index rather than D1, so a homepage
 * visit costs one R2 read and never touches file content.
 *
 * @module app/api/homepage/latest-outlines/route
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limitParam = Number.parseInt(new URL(request.url).searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 12;
  try {
    const db = await getDBFromContext();
    await ensureTopicStarterColumns(db);
    const index = await getTopicStarterFileIndex(db);
    return NextResponse.json(latestOutlineFiles(index.items, limit), {
      // The index itself is rebuilt daily and after each edit; a few minutes
      // of edge caching keeps homepage traffic off the bucket.
      headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("homepage: latest outlines failed", error);
    return NextResponse.json([]);
  }
}
