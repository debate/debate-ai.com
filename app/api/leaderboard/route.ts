import { NextResponse } from "next/server";
import {
  scrapeDivision,
  getDatasets,
} from "@/lib/third-party-sync/sync-team-rank-debatedrills";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year") || "2026";
  const division = searchParams.get("division") || "VPF";

  console.log(
    "[v0] Leaderboard API called with year:",
    year,
    "division:",
    division,
  );

  try {
    const datasets = getDatasets(year);
    const config = datasets.find((d) => d.division === division);

    if (!config) {
      return NextResponse.json({ error: "Invalid division" }, { status: 400 });
    }

    const data = await scrapeDivision(config);
    console.log("[v0] Scraped data count:", data.length);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[v0] Error in leaderboard API:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch leaderboard data",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
