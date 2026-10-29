import { NextResponse } from "next/server";
import {
  fetchTocBidsSheet,
  TOC_BIDS_SHEET_URL,
} from "@debate-ai/rankings-adapter/src/sync/sync-toc-bids-sheet";
import {
  TOC_BIDS_SNAPSHOT_DATE,
  tocBidsSnapshot,
} from "@debate-ai/rankings-adapter/src/sync/toc-bids-snapshot";

/**
 * This season's high school policy TOC bids, from the published bids sheet.
 *
 * Downloads the sheet as CSV on each miss and lets the edge cache hold it for
 * an hour, so the sheet's maintainers see their edits on the rankings page
 * within the hour without every visitor hitting Google. When Google cannot be
 * reached the bundled snapshot is served instead (`source: "snapshot"`), with a
 * short cache so the live sheet is retried soon.
 */
export async function GET() {
  try {
    const teams = await fetchTocBidsSheet(TOC_BIDS_SHEET_URL);
    return NextResponse.json(
      { source: "sheet", fetchedAt: new Date().toISOString(), teams },
      { headers: { "Cache-Control": "public, max-age=900, s-maxage=3600" } },
    );
  } catch (error) {
    console.error(
      "[toc-bids] sheet download failed, serving snapshot:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { source: "snapshot", fetchedAt: TOC_BIDS_SNAPSHOT_DATE, teams: tocBidsSnapshot() },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
    );
  }
}
