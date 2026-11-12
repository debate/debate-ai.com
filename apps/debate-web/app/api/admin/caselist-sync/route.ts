/**
 * @fileoverview Admin-only discovery for the openCaselist speech-doc sync.
 *
 * `GET` with no query lists the current season's caselists, and `GET ?season=`
 * (`25` or `2025`) a past season's, back to 2013-14. `GET ?slug=` (a
 * slug, or a downloads page URL such as
 * `https://opencaselist.com/hspolicy26/downloads`) reads that caselist's
 * downloads page through the signed-in openCaselist API — the only source —
 * and answers with the archives found, the newest archive of each family, and
 * the incremental plan: which archives the card library has not imported yet.
 * It needs the `OPENCASELIST_API_KEY` secret (or `CASELIST_USERNAME` +
 * `CASELIST_PASSWORD`).
 *
 * Only discovery happens here. The archives themselves are hundreds of
 * megabytes of ZIP, past what a Worker can hold, so the admin panel downloads
 * them straight from the (CORS-open) bucket, converts the documents in the
 * browser and posts card rows to `/api/admin/debate-cards`, exactly as the
 * Parquet importer does. One slug per request keeps each call well inside the
 * Worker's subrequest budget.
 *
 * @module app/api/admin/caselist-sync/route
 */
import { NextRequest, NextResponse } from "next/server";
import { like } from "drizzle-orm";
import {
  caselistsForSeason,
  parseCaselistSeason,
  parseCaselistSlug,
} from "@debate-ai/research-evidence/src/caselist/caselist-config";
import { fetchCaselistDownloads } from "@debate-ai/research-evidence/src/caselist/caselist-sync";
import {
  describeArchiveLink,
  planCaselistSync,
  selectLatestByFamily,
} from "@debate-ai/research-evidence/src/caselist/caselist-discovery";
import { listArchives } from "@debate-ai/research-evidence/src/caselist/downloads-page-parser";
import { authorizeCardImport } from "@/lib/admin/debate-card-import";
import { caselistCredentials } from "@/lib/caselist/team-caselist";
import { getDBFromContext } from "@/lib/database/context";
import { debateCardImports } from "@/lib/database/schema";

/**
 * Lists caselists, or discovers one caselist's archives and sync plan.
 *
 * @param request - Optional `?slug=` naming the caselist, or `?season=` picking
 *   which season's caselists to list.
 * @returns `{ caselists }`, or the caselist's manifest, families and plan.
 */
export async function GET(request: NextRequest) {
  const access = await authorizeCardImport(request);
  if (!access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const requested = request.nextUrl.searchParams.get("slug");
  if (!requested) {
    const rawSeason = request.nextUrl.searchParams.get("season");
    if (rawSeason === null) return NextResponse.json({ caselists: caselistsForSeason() });
    const season = parseCaselistSeason(rawSeason);
    if (season === null) {
      return NextResponse.json({ error: `Unknown season: ${rawSeason}` }, { status: 400 });
    }
    return NextResponse.json({ caselists: caselistsForSeason(season) });
  }

  const caselist = parseCaselistSlug(requested);
  if (!caselist) {
    return NextResponse.json({ error: `Unknown caselist: ${requested}` }, { status: 400 });
  }

  const credentials = caselistCredentials();
  if (!credentials) {
    return NextResponse.json(
      {
        error:
          "openCaselist is not configured: set the OPENCASELIST_API_KEY secret (or CASELIST_USERNAME and CASELIST_PASSWORD).",
      },
      { status: 503 },
    );
  }

  try {
    const downloads = await fetchCaselistDownloads(caselist.slug, credentials);

    const db = await getDBFromContext();
    const imported = await db
      .select({ fileName: debateCardImports.fileName })
      .from(debateCardImports)
      .where(like(debateCardImports.fileName, `${caselist.slug}-%`));
    const importedFileNames = imported.map((row: { fileName: string }) => row.fileName);

    const archives = listArchives(downloads);
    const latest = selectLatestByFamily(
      archives.map((archive) => describeArchiveLink(archive.url, downloads.pageUrl)),
    ).map((archive) => archive.fileName);

    return NextResponse.json({
      caselist,
      source: downloads.source,
      notes: downloads.notes,
      fetchedAt: downloads.fetchedAt,
      pageUrl: downloads.pageUrl,
      archives,
      latest,
      imported: importedFileNames,
      pending: planCaselistSync(downloads, importedFileNames),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Discovery failed.", details: (error as Error).message },
      { status: 500 },
    );
  }
}
