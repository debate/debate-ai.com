import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { purgeOldReuseCheckLogRows } from "@/lib/evidence-reuse-check/purge-reuse-check-log";

/**
 * Manually triggers the `reuse_check_log` retention purge (idea #7's
 * follow-up — see `purge-reuse-check-log.ts`). This same purge also runs
 * automatically every week via the worker's `scheduled` export; this route
 * exists for an admin who wants it applied right away rather than waiting
 * for the next weekly tick.
 */
export async function POST() {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await purgeOldReuseCheckLogRows();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error purging reuse-check log:", error);
    return NextResponse.json(
      { error: "Failed to purge reuse-check log", details: (error as Error).message },
      { status: 500 },
    );
  }
}
