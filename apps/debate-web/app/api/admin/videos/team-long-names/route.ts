import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { fillTeamLongNames } from "@/lib/videos/fill-team-long-names";

/**
 * Fills debaters' last names (`videos.aff_team_long` / `neg_team_long`) for
 * round videos whose teams are a school and two initials, one season per
 * call, from that season's top-team rankings (debatedata for college,
 * the Elo ratings for HS policy, PF and college). See
 * `lib/videos/fill-team-long-names.ts`.
 *
 * Body (optional JSON): `{ season?: number, overwrite?: boolean }`. With no
 * season the oldest one is handled; the response's `nextSeason` is the one to
 * send next, `null` after the last.
 */
export async function POST(request: Request) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { season?: unknown; overwrite?: unknown };
  const season = typeof body?.season === "number" && Number.isInteger(body.season) ? body.season : null;

  try {
    const db = await getDBFromContext();
    const result = await fillTeamLongNames(db, { season, overwrite: body?.overwrite === true });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Error filling team last names:", error);
    const err = error as Error & { cause?: unknown };
    const cause = err.cause instanceof Error ? err.cause.message : undefined;
    return NextResponse.json(
      { error: "Failed to fill team last names", details: cause ?? err.message?.slice(0, 500) },
      { status: 500 },
    );
  }
}
