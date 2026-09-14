import { NextResponse } from "next/server";
import {
  CURRENT_YEAR,
  resolveLeaderboard,
} from "@/lib/leaderboard/resolve";

/**
 * Leaderboard rows for a division+year.
 *
 * The HTTP shell only; which sources are consulted and what can still be
 * served when one of them is down lives in `lib/leaderboard/resolve`.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year") || CURRENT_YEAR;
  const division = (searchParams.get("division") || "VPF").toUpperCase();

  const result = await resolveLeaderboard(division, year);

  if (result.status === 200) {
    return NextResponse.json(result.rows);
  }

  return NextResponse.json(
    { error: result.error, details: result.details },
    { status: result.status },
  );
}
