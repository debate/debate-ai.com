import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { recomputeVideoStacks } from "@/lib/videos/recompute-video-stacks";

/**
 * Re-derives stacked-playlist membership (`stack_key`/`stack_position`) for
 * every row in the `videos` table.
 *
 * Every future publish already keeps this current on its own — both
 * `publishRoundVideos` and the legacy single-round publish endpoint call
 * `recomputeVideoStacks` after writing (see that module's fileoverview). This
 * endpoint exists for a database whose stacks fell behind *before* that
 * wiring existed: rounds published through the live YouTube pipeline prior
 * to this endpoint's introduction were never stacked, and a full JSON
 * re-seed does not touch them (they were never part of the JSON assets), so
 * only this recompute reaches them. Safe to re-run: a row already carrying
 * its correct placement produces no write.
 */
export async function POST() {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = await getDBFromContext();
    const result = await recomputeVideoStacks(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Error recomputing video stacks:", error);
    const err = error as Error & { cause?: unknown };
    const cause = err.cause instanceof Error ? err.cause.message : undefined;
    return NextResponse.json(
      { error: "Failed to recompute video stacks", details: cause ?? err.message?.slice(0, 500) },
      { status: 500 },
    );
  }
}
