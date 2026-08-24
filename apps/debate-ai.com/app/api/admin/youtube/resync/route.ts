import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { youtubeSyncRuns } from "@/lib/database/schema";
import { resyncYouTubeRounds } from "@/lib/youtube/resync-rounds";

/** Triggers a full resync of round videos from every subscribed YouTube channel. */
export async function POST() {
  const { isAdmin, email } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await resyncYouTubeRounds(email);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error resyncing YouTube rounds:", error);
    return NextResponse.json(
      { error: "Failed to resync videos", details: (error as Error).message },
      { status: 500 },
    );
  }
}

/** Recent resync history, newest first, for the admin page's status panel. */
export async function GET() {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = await getDBFromContext();
  const runs = await db
    .select()
    .from(youtubeSyncRuns)
    .orderBy(desc(youtubeSyncRuns.startedAt))
    .limit(10);

  return NextResponse.json({ runs });
}
