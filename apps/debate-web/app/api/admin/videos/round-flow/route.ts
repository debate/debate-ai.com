/**
 * @fileoverview The admin "Hourly round flows" panel's API: the status of the
 * hourly job that gives one more round an hour (newest first) its last four
 * speeches' LLM summaries and its flow chart.
 *
 * `GET` returns the panel's status. `POST { action: "run", videoId? }` runs
 * the next round now (or the given one), the same work the cron does;
 * `POST { action: "pause" | "resume" }` switches the hourly job off or on.
 * See `lib/videos/hourly-round-flow.ts`.
 *
 * @module app/api/admin/videos/round-flow/route
 */

import { NextRequest, NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/auth/admin";
import { getUserId } from "@/lib/auth/session";
import { getDBFromContext } from "@/lib/database/context";
import { describeError } from "@/lib/database/errors";
import { sharedProviderKey } from "@/lib/videos/transcript-scraper";
import { getRoundFlowStats, runRoundFlowOnce, setRoundFlowPaused } from "@/lib/videos/hourly-round-flow";

export async function GET() {
  const { isAdmin } = await getStaffAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const db = await getDBFromContext();
    return NextResponse.json({
      ...(await getRoundFlowStats(db)),
      aiConfigured: sharedProviderKey() !== null,
    });
  } catch (error) {
    console.error("Failed to load round flow stats:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to load stats", details: describeError(error) },
      { status: 500 },
    );
  }
}

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
    // An empty body runs the next round.
  }
  const action = body.action === "pause" || body.action === "resume" ? body.action : "run";

  try {
    const db = await getDBFromContext();
    if (action !== "run") {
      await setRoundFlowPaused(db, action === "pause");
      return NextResponse.json({ ok: true, paused: action === "pause" });
    }
    const providerKey = sharedProviderKey();
    if (!providerKey) {
      return NextResponse.json(
        { error: "No shared AI key is configured (OPENROUTER_API_KEY or ANTHROPIC_API_KEY)." },
        { status: 503 },
      );
    }
    const videoId =
      typeof body.videoId === "string" && body.videoId.trim() ? body.videoId.trim() : null;
    return NextResponse.json(await runRoundFlowOnce(db, providerKey, { trigger: "admin", userId, videoId }));
  } catch (error) {
    console.error("Failed to run round flow:", describeError(error), error);
    return NextResponse.json(
      { error: "Failed to run round flow", details: describeError(error) },
      { status: 500 },
    );
  }
}
