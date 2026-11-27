import { NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { ensureRoundVideosTable } from "@/lib/youtube/round-videos-table";
import { recategorizeSuperDebates } from "@/lib/videos/recategorize-super-debates";

/**
 * Files every Super Debate video — queued lectures and already-published
 * videos alike — under the "Open Super Debates" lecture category, see
 * `recategorizeSuperDebates`. Idempotent; the admin page's "Re-file Super
 * Debates" button.
 */
export async function POST() {
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = await getDBFromContext();
  await ensureRoundVideosTable(db);
  const result = await recategorizeSuperDebates(db);
  return NextResponse.json({ ok: true, ...result });
}
