import { NextResponse, type NextRequest } from "next/server";
import { lookupTabroomResult } from "@debate-ai/videos-admin/src/lib/tabroom-results";
import { tabroomFetch } from "@/lib/judge-paradigms/tabroom";

/** Longest value accepted for any one field — tournament and team names are short. */
const MAX_FIELD = 120;

/**
 * Looks a high-school round up on Tabroom for the video edit dialog's
 * "Look up results" button (shown for Policy, PF, LD and Parliamentary).
 *
 * Query: `tournament`, `roundLevel`, `affTeam`, `negTeam`, `seasonYear`,
 * `publishedAt`, `style` — what the form holds now. Returns the lookup from
 * `@debate-ai/videos-admin/src/lib/tabroom-results`; writes nothing. Public,
 * because viewers suggesting an edit see the button too: it only reads
 * Tabroom's public API (signed in as the site account), with fixed paths.
 */
export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const text = (key: string) => (params.get(key) ?? "").slice(0, MAX_FIELD);
  const seasonYear = Number.parseInt(params.get("seasonYear") ?? "", 10);
  const style = Number.parseInt(params.get("style") ?? "", 10);
  const publishedAt = text("publishedAt");

  try {
    const result = await lookupTabroomResult(
      {
        tournament: text("tournament"),
        roundLevel: text("roundLevel") || null,
        affTeam: text("affTeam"),
        negTeam: text("negTeam"),
        seasonYear: Number.isFinite(seasonYear) ? seasonYear : null,
        publishedAt: /^\d{4}-\d{2}-\d{2}/.test(publishedAt) ? publishedAt.slice(0, 10) : null,
        style: Number.isFinite(style) ? style : null,
      },
      tabroomFetch(),
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Tabroom results lookup failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 502 },
    );
  }
}
