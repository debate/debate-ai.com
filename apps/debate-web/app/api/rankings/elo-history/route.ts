import { NextResponse, type NextRequest } from "next/server";
import { ELO_HISTORY_MAX_TEAMS, isEloHistoryDataset } from "@debate-ai/rankings/src/leaderboard/eloHistory";
import { getDBFromContext } from "@/lib/database/context";
import { readEloHistory } from "@/lib/rankings/elo-snapshot-store";

/**
 * @fileoverview The monthly Elo snapshots of the teams on a page
 * (`?dataset=hspf&teams=harker-lee-kim,strake-jesuit-ab`), from D1
 * (`lib/rankings/elo-snapshot-store.ts`). Answers `{ teams: {} }` when no
 * month is saved yet, so the sparklines stay hidden.
 *
 * @module app/api/rankings/elo-history/route
 */
export async function GET(request: NextRequest) {
  const dataset = request.nextUrl.searchParams.get("dataset") ?? "";
  if (!isEloHistoryDataset(dataset)) {
    return NextResponse.json({ error: "Unknown dataset" }, { status: 400 });
  }
  const keys = (request.nextUrl.searchParams.get("teams") ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter((key) => /^[a-z0-9-]{1,200}$/.test(key))
    .slice(0, ELO_HISTORY_MAX_TEAMS);
  if (keys.length === 0) return NextResponse.json({ dataset, teams: {} });
  try {
    const teams = await readEloHistory(await getDBFromContext(), dataset, keys);
    return NextResponse.json(
      { dataset, teams },
      { headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } },
    );
  } catch (error) {
    console.error("[elo-snapshot] could not serve", dataset, error);
    return NextResponse.json({ dataset, teams: {} }, { headers: { "Cache-Control": "no-store" } });
  }
}
