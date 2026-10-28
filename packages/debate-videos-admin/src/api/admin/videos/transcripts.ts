/**
 * @fileoverview Stats and backfill for the library's YouTube transcripts.
 *
 * `GET` returns how many videos have a cached transcript and an AI
 * summary. `POST` processes one page of videos that have no cached
 * transcript yet — fetching their captions into `video_transcripts`
 * and, when `generateSummaries` is on, writing an AI summary
 * document per video — and returns the cursor for the next page.
 *
 * The caller loops `POST` until `done`, so a corpus of thousands of
 * videos is walked across many short requests rather than one that
 * would time out.
 *
 * @module app/api/admin/videos/transcripts/route
 */

import { NextRequest, NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { describeError } from "@/lib/database/errors";
import {
  getTranscriptScraperStats,
  scrapeTranscriptsPage,
  sharedProviderKey,
} from "@/lib/videos/transcript-scraper";

/** Default and maximum page sizes. */
const DEFAULT_PAGE_ROWS = 20;
const MAX_PAGE_ROWS = 100;

/**
 * How many videos have a cached transcript and an AI summary, for
 * the scraper panel's status line.
 */
export async function GET(req: NextRequest) {
  const { isAdmin } = await getStaffAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = await getDBFromContext();
    return NextResponse.json(await getTranscriptScraperStats(db));
  } catch (error) {
    console.error("Failed to load transcript scraper stats:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to load stats", details: describeError(error) },
      { status: 500 },
    );
  }
}

/**
 * Processes one page of videos with no cached transcript.
 *
 * Body: `{ afterId?: string, limit?: number, generateSummaries?: boolean }`.
 * Summaries cost money per video, so they are skipped rather than
 * failing the whole page when no shared AI key is configured.
 */
export async function POST(req: NextRequest) {
  const { isAdmin } = await getStaffAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { afterId?: unknown; limit?: unknown; generateSummaries?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // An empty body starts from the beginning with the default page size.
  }

  const afterId = typeof body.afterId === "string" ? body.afterId : null;
  const limit = Math.min(
    MAX_PAGE_ROWS,
    Math.max(1, Math.trunc(Number(body.limit) || DEFAULT_PAGE_ROWS)),
  );
  const generateSummaries = body.generateSummaries === true;

  const providerKey = generateSummaries ? sharedProviderKey() : null;

  try {
    const db = await getDBFromContext();
    const result = await scrapeTranscriptsPage(
      db,
      afterId,
      limit,
      generateSummaries,
      providerKey,
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to scrape transcripts:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to scrape transcripts", details: describeError(error) },
      { status: 500 },
    );
  }
}
