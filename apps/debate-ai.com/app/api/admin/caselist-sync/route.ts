/**
 * @fileoverview Admin-only discovery for the openCaselist speech-doc sync.
 *
 * `GET` with no query lists the current season's caselists. `GET ?slug=` runs
 * discovery for one caselist — the site's API, the downloads page (the "5s"
 * style), the all-years crawl, then a bucket probe — and answers with the
 * archives found, the newest archive of each family, and the incremental
 * plan: which archives the card library has not imported yet.
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
import { caselistsForSeason, parseCaselistSlug } from "debate-data-sync/src/caselist/caselist-config";
import { fetchCaselistDownloads } from "debate-data-sync/src/caselist/caselist-sync";
import {
  describeArchiveLink,
  planCaselistSync,
  selectLatestByFamily,
} from "debate-data-sync/src/caselist/caselist-discovery";
import { listArchives } from "debate-data-sync/src/caselist/downloads-page-parser";
import { authorizeCardImport } from "@/lib/admin/debate-card-import";
import { getDBFromContext } from "@/lib/database/context";
import { debateCardImports } from "@/lib/database/schema";

/**
 * Lists caselists, or discovers one caselist's archives and sync plan.
 *
 * @param request - Optional `?slug=` naming the caselist.
 * @returns `{ caselists }`, or the caselist's manifest, families and plan.
 */
export async function GET(request: NextRequest) {
  const access = await authorizeCardImport(request);
  if (!access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const requested = request.nextUrl.searchParams.get("slug");
  if (!requested) {
    return NextResponse.json({ caselists: caselistsForSeason() });
  }

  const caselist = parseCaselistSlug(requested);
  if (!caselist) {
    return NextResponse.json({ error: `Unknown caselist: ${requested}` }, { status: 400 });
  }

  try {
    const downloads = await fetchCaselistDownloads(caselist.slug, {
      timeout: 20,
      crawlPages: 4,
      probeWeeks: 8,
    });

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
