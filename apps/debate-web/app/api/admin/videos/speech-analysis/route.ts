/**
 * @fileoverview The admin "Speech AI" batch job: speech segmentation, a
 * summary of every speech and what it could have done instead.
 *
 * `GET ?scope=goat|all` returns the panel's counts. `POST` processes one
 * page of videos and returns the cursor for the next; the caller loops until
 * `done`. See `lib/videos/speech-analysis.ts`.
 *
 * @module app/api/admin/videos/speech-analysis/route
 */

import { NextRequest, NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { describeError } from "@/lib/database/errors";
import { sharedProviderKey } from "@/lib/videos/transcript-scraper";
import {
  getSpeechAnalysisStats,
  isSpeechAnalysisScope,
  processSpeechAnalysisPage,
} from "@/lib/videos/speech-analysis";

/** Two model calls per video, so pages stay small. */
const DEFAULT_PAGE_ROWS = 1;
const MAX_PAGE_ROWS = 5;

/** The longest admin prompt accepted. */
const MAX_INSTRUCTIONS_CHARS = 20_000;

/** Counts for the panel's status line. */
export async function GET(req: NextRequest) {
  const { isAdmin } = await getStaffAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const scopeParam = req.nextUrl.searchParams.get("scope");
  const scope = isSpeechAnalysisScope(scopeParam) ? scopeParam : "goat";

  try {
    const db = await getDBFromContext();
    return NextResponse.json({
      ...(await getSpeechAnalysisStats(db, scope)),
      aiConfigured: sharedProviderKey() !== null,
    });
  } catch (error) {
    console.error("Failed to load speech analysis stats:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to load stats", details: describeError(error) },
      { status: 500 },
    );
  }
}

/**
 * Processes one page.
 *
 * Body: `{ scope?: "goat" | "all", afterId?: string, limit?: number,
 * instructions?: string, overwrite?: boolean, videoId?: string,
 * dryRun?: boolean }`.
 */
export async function POST(req: NextRequest) {
  const { isAdmin } = await getStaffAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // An empty body runs the first page of the default scope.
  }

  const providerKey = sharedProviderKey();
  if (!providerKey) {
    return NextResponse.json(
      { error: "No shared AI key is configured (OPENROUTER_API_KEY or ANTHROPIC_API_KEY)." },
      { status: 503 },
    );
  }

  const scope = isSpeechAnalysisScope(body.scope) ? body.scope : "goat";
  const afterId = typeof body.afterId === "string" ? body.afterId : null;
  const limit = Math.min(
    MAX_PAGE_ROWS,
    Math.max(1, Math.trunc(Number(body.limit) || DEFAULT_PAGE_ROWS)),
  );
  const instructions =
    typeof body.instructions === "string" && body.instructions.trim()
      ? body.instructions.slice(0, MAX_INSTRUCTIONS_CHARS)
      : null;
  const videoId =
    typeof body.videoId === "string" && body.videoId.trim() ? body.videoId.trim() : null;

  try {
    const db = await getDBFromContext();
    const result = await processSpeechAnalysisPage(db, providerKey, {
      scope,
      afterId,
      limit,
      instructions,
      overwrite: body.overwrite === true,
      videoId,
      dryRun: body.dryRun === true,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to run speech analysis:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to run speech analysis", details: describeError(error) },
      { status: 500 },
    );
  }
}
