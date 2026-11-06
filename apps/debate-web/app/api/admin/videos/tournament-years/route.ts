import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { stripTournamentYears } from "@/lib/videos/strip-tournament-years";

/**
 * Removes the year from saved tournament names (`"2024 TOC"` → `"TOC"`) in
 * the video library and the resync queue, one batch of names per call. See
 * `lib/videos/strip-tournament-years.ts`. The response's `remaining` is how
 * many names still hold a year; call again until it is 0.
 */
export async function POST() {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = await getDBFromContext();
    const result = await stripTournamentYears(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Error stripping tournament years:", error);
    const err = error as Error & { cause?: unknown };
    const cause = err.cause instanceof Error ? err.cause.message : undefined;
    return NextResponse.json(
      { error: "Failed to strip tournament years", details: cause ?? err.message?.slice(0, 500) },
      { status: 500 },
    );
  }
}
