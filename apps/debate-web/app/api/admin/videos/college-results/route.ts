import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { fillCollegeResults } from "@/lib/videos/fill-college-results";

/**
 * Looks one batch of college rounds up on College Debate Results and saves
 * the winner, ballot count, judges and squirrels. See
 * `lib/videos/fill-college-results.ts`.
 *
 * Body (optional JSON): `{ since?: number }` — unix seconds; rows checked at
 * or after it are skipped (0, the default, finishes rows never checked). Call
 * again until the response's `remaining` is 0.
 */
export async function POST(request: Request) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { since?: unknown };
  const since = typeof body?.since === "number" && Number.isFinite(body.since) ? body.since : 0;

  try {
    const db = await getDBFromContext();
    const result = await fillCollegeResults(db, { since });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Error filling college results:", error);
    const err = error as Error & { cause?: unknown };
    const cause = err.cause instanceof Error ? err.cause.message : undefined;
    return NextResponse.json(
      { error: "Failed to fill college results", details: cause ?? err.message?.slice(0, 500) },
      { status: 500 },
    );
  }
}
