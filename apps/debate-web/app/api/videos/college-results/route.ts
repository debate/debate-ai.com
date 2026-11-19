import { NextResponse, type NextRequest } from "next/server";
import { lookupCollegeResult } from "@debate-ai/videos-admin/src/lib/college-results";

/** Longest value accepted for any one field — tournament and team names are short. */
const MAX_FIELD = 120;

/**
 * Looks a college round up on College Debate Results for the video edit
 * dialog's "Look up results" button (shown only for college videos).
 *
 * Query: `tournament`, `roundLevel`, `affTeam`, `negTeam`, `seasonYear`,
 * `publishedAt` — what the form holds now. Returns the lookup from
 * `@debate-ai/videos-admin/src/lib/college-results`; writes nothing. Public,
 * because viewers suggesting an edit see the button too: it only reads the
 * results site's public data, with fixed paths.
 */
export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const text = (key: string) => (params.get(key) ?? "").slice(0, MAX_FIELD);
  const seasonYear = Number.parseInt(params.get("seasonYear") ?? "", 10);
  const publishedAt = text("publishedAt");

  try {
    const result = await lookupCollegeResult({
      tournament: text("tournament"),
      roundLevel: text("roundLevel") || null,
      affTeam: text("affTeam"),
      negTeam: text("negTeam"),
      seasonYear: Number.isFinite(seasonYear) ? seasonYear : null,
      publishedAt: /^\d{4}-\d{2}-\d{2}/.test(publishedAt) ? publishedAt.slice(0, 10) : null,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: `College Debate Results lookup failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 502 },
    );
  }
}
