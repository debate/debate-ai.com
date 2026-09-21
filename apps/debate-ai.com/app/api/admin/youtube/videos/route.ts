import { NextRequest, NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { listPendingRoundVideos } from "@/lib/youtube/admin-round-videos";

/**
 * Keyset-paginated list of SQL-stored round videos, newest first, for the
 * admin page's infinite scroll.
 *
 * Query parameters: `q`, `style`, `channel`, `cursor`, `limit`.
 */
export async function GET(req: NextRequest) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = await getDBFromContext();
  const { searchParams } = new URL(req.url);
  const styleParam = Number(searchParams.get("style"));

  const page = await listPendingRoundVideos(db, {
    limit: Number(searchParams.get("limit")) || undefined,
    cursor: searchParams.get("cursor"),
    style: searchParams.get("style") && Number.isFinite(styleParam) ? styleParam : null,
    channel: searchParams.get("channel"),
    q: searchParams.get("q"),
  });

  return NextResponse.json(page);
}
