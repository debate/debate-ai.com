import { NextRequest, NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { ensureRoundVideosTable } from "@/lib/youtube/round-videos-table";
import { refileLectures } from "@/lib/videos/refile-lectures";

/**
 * Files Congressional Debate lectures — queued and already published — under
 * the Congress shelf, and queued lectures with no valid category under
 * Miscellaneous; see `refileLectures`. Idempotent; the admin page's "Re-file
 * Congress & Misc." button. `?dryRun=1` reports the matches without writing.
 */
export async function POST(req: NextRequest) {
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const db = await getDBFromContext();
  await ensureRoundVideosTable(db);
  const result = await refileLectures(db, { dryRun });
  return NextResponse.json({ ok: true, ...result });
}
