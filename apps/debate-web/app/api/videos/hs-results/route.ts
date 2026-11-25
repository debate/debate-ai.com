import { NextResponse, type NextRequest } from "next/server";
import { TabroomAuthError, lookupHsResult } from "@debate-ai/videos-admin/src/lib/hs-results";
import { tabroomFetch } from "@/lib/judge-paradigms/tabroom";

/** Longest value accepted for any one field — tournament and team names are short. */
const MAX_FIELD = 120;

/**
 * Looks a high school Policy, PF or LD round up on Tabroom for the video edit
 * dialog's "Look up results" button (shown for styles 1–3).
 *
 * Query: `style`, `tournament`, `roundLevel`, `affTeam`, `negTeam`,
 * `seasonYear`, `publishedAt` — what the form holds now. Returns the lookup
 * from `@debate-ai/videos-admin/src/lib/hs-results`; writes nothing. Public,
 * because viewers suggesting an edit see the button too: it only reads
 * Tabroom's published results, at fixed paths. Requests are signed in as the
 * site's Tabroom account (`TABROOM_API_KEY`), since Tabroom answers round
 * results only to signed-in users.
 */
export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const text = (key: string) => (params.get(key) ?? "").slice(0, MAX_FIELD);
  const seasonYear = Number.parseInt(params.get("seasonYear") ?? "", 10);
  const publishedAt = text("publishedAt");

  try {
    const result = await lookupHsResult(
      {
        style: text("style"),
        tournament: text("tournament"),
        roundLevel: text("roundLevel") || null,
        affTeam: text("affTeam"),
        negTeam: text("negTeam"),
        seasonYear: Number.isFinite(seasonYear) ? seasonYear : null,
        publishedAt: /^\d{4}-\d{2}-\d{2}/.test(publishedAt) ? publishedAt.slice(0, 10) : null,
      },
      tabroomFetch(),
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Tabroom lookup failed: ${message}` },
      { status: error instanceof TabroomAuthError ? 503 : 502 },
    );
  }
}
