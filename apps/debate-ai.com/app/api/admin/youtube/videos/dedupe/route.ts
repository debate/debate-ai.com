import { NextRequest, NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { dedupeRoundQueue } from "@/lib/videos/publish-round-video";

/**
 * Removes every queued round video that is already in the public `videos`
 * table (optionally narrowed to the style the admin page has filtered to),
 * without publishing it — the published copy is kept as is. The admin page's
 * "Deduplicate" button, next to "Publish all".
 */
export async function POST(req: NextRequest) {
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const styleParam = searchParams.get("style");
  const style = styleParam ? Number(styleParam) : null;

  const db = await getDBFromContext();
  const removed = await dedupeRoundQueue(db, style != null && Number.isFinite(style) ? style : null);

  return NextResponse.json({ ok: true, removed: removed.length });
}
