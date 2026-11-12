/**
 * @fileoverview The admin "Watch page AI" batch job: pre-generates the watch
 * page's LLM summaries and Alternatives runs for each round's last three
 * speeches, so readers open them already done.
 *
 * `GET ?scope=goat|all` returns the panel's counts. `POST` runs one page and
 * returns the cursor for the next; the caller loops until `done`. See
 * `lib/videos/watch-ai-precompute.ts`.
 *
 * @module app/api/admin/videos/watch-ai/route
 */

import { NextRequest, NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/auth/admin";
import { getUserId } from "@/lib/auth/session";
import { getDBFromContext } from "@/lib/database/context";
import { describeError } from "@/lib/database/errors";
import { sharedProviderKey } from "@/lib/videos/transcript-scraper";
import { isSpeechAnalysisScope } from "@/lib/videos/speech-analysis";
import { getWatchAiStats, processWatchAiPage } from "@/lib/videos/watch-ai-precompute";

/** Up to seven model calls per round, so a request runs one by default. */
const DEFAULT_LIMIT = 1;
const MAX_LIMIT = 3;

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
      ...(await getWatchAiStats(db, scope)),
      aiConfigured: sharedProviderKey() !== null,
    });
  } catch (error) {
    console.error("Failed to load watch AI stats:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to load stats", details: describeError(error) },
      { status: 500 },
    );
  }
}

/**
 * Runs one page.
 *
 * Body: `{ scope?: "goat" | "all", afterId?: string, limit?: number,
 * videoId?: string }`.
 */
export async function POST(req: NextRequest) {
  const { isAdmin } = await getStaffAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in again to run this." }, { status: 401 });
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
  const afterId = typeof body.afterId === "string" && body.afterId ? body.afterId : null;
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(Number(body.limit) || DEFAULT_LIMIT)));
  const videoId =
    typeof body.videoId === "string" && body.videoId.trim() ? body.videoId.trim() : null;

  try {
    const db = await getDBFromContext();
    return NextResponse.json(
      await processWatchAiPage(db, providerKey, userId, { scope, afterId, limit, videoId }),
    );
  } catch (error) {
    console.error("Failed to run watch AI:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to run watch page AI", details: describeError(error) },
      { status: 500 },
    );
  }
}
