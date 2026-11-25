/**
 * @fileoverview The admin "Detect speeches on every round" batch job: runs
 * the watch page's Detect speeches on every round, newest first, on
 * OpenRouter's free router, and saves each detection for every viewer.
 *
 * `GET` returns the panel's counts. `POST` runs one page and returns the
 * cursor for the next; the caller loops until `done`, waiting and retrying
 * when the page reports `rateLimited`. See
 * `lib/videos/detect-speeches-batch.ts`.
 *
 * @module app/api/admin/videos/detect-speeches/route
 */

import { NextRequest, NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/auth/admin";
import { getUserId } from "@/lib/auth/session";
import { getDBFromContext } from "@/lib/database/context";
import { describeError } from "@/lib/database/errors";
import { ownThenSharedKeys } from "@/lib/ai/provider-key";
import {
  getDetectSpeechesStats,
  processDetectSpeechesPage,
} from "@/lib/videos/detect-speeches-batch";

/** One model call per round (up to three on empty replies), so a few per request. */
const DEFAULT_LIMIT = 2;
const MAX_LIMIT = 5;

/** Whether an OpenRouter key is available, and whether it is the admin's own. */
function keyStatus(req: NextRequest) {
  const keys = ownThenSharedKeys(req, "openrouter");
  return { aiConfigured: keys.length > 0, ownKey: keys[0]?.own === true };
}

/** Counts for the panel's status line. */
export async function GET(req: NextRequest) {
  const { isAdmin } = await getStaffAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const db = await getDBFromContext();
    return NextResponse.json({
      ...(await getDetectSpeechesStats(db)),
      ...keyStatus(req),
    });
  } catch (error) {
    console.error("Failed to load detect speeches stats:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to load stats", details: describeError(error) },
      { status: 500 },
    );
  }
}

/**
 * Runs one page.
 *
 * Body: `{ afterId?: string, limit?: number }`.
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
    // An empty body runs the first page.
  }

  // The admin's own OpenRouter key first, then the site's shared one.
  const keys = ownThenSharedKeys(req, "openrouter");
  if (keys.length === 0) {
    return NextResponse.json(
      { error: "No OpenRouter key: add your own in Settings → General, or set OPENROUTER_API_KEY on the server. This job only uses the free router." },
      { status: 503 },
    );
  }

  const afterId = typeof body.afterId === "string" && body.afterId ? body.afterId : null;
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(Number(body.limit) || DEFAULT_LIMIT)));

  try {
    const db = await getDBFromContext();
    return NextResponse.json(await processDetectSpeechesPage(db, keys, userId, { afterId, limit }));
  } catch (error) {
    console.error("Failed to run detect speeches batch:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to run Detect speeches", details: describeError(error) },
      { status: 500 },
    );
  }
}
