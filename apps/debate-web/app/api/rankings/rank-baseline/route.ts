import { NextResponse, type NextRequest } from "next/server";
import { isRankBaselineScope } from "@debate-ai/rankings/src/leaderboard/rankBaseline";
import { getDBFromContext } from "@/lib/database/context";
import { readRankBaseline } from "@/lib/rankings/rank-baseline-store";

/**
 * @fileoverview The saved 90-day rank baseline for one list
 * (`?scope=team:hspf` or `?scope=school:VCX`), from D1
 * (`lib/rankings/rank-baseline-store.ts`). Answers `{ capturedAt: null }`
 * when no save is at least a day old yet, so the table falls back to last
 * season.
 *
 * @module app/api/rankings/rank-baseline/route
 */
export async function GET(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get("scope") ?? "";
  if (!isRankBaselineScope(scope)) {
    return NextResponse.json({ error: "Unknown scope" }, { status: 400 });
  }
  try {
    const baseline = await readRankBaseline(await getDBFromContext(), scope);
    return NextResponse.json(baseline ?? { scope, capturedAt: null, rows: null }, {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
    });
  } catch (error) {
    console.error("[rank-baselines] could not serve", scope, error);
    return NextResponse.json({ scope, capturedAt: null, rows: null }, { headers: { "Cache-Control": "no-store" } });
  }
}
