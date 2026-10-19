import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { describeError } from "@/lib/database/errors";
import { youtubeSyncRuns } from "@/lib/database/schema";
import { resyncYouTubeRounds, type ChannelScanScope } from "@/lib/youtube/resync-rounds";

const SCOPES = ["all", "active", "defunct"] as const;

/**
 * Triggers a resync of round videos from the subscribed YouTube channels —
 * every one by default, or only the active or defunct ones when the body
 * names a `scope` (the channels tab's "Check defunct channels" button sends
 * `"defunct"`), or just one channel when it names a `channelId` row id (a
 * row's "Check" button).
 */
export async function POST(req: Request) {
  const { isAdmin, email } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let publishedAfter: string | undefined;
  let scope: ChannelScanScope = "all";
  try {
    const body = await req.json();
    if (body?.scope !== undefined) {
      if (!SCOPES.includes(body.scope)) {
        return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
      }
      scope = body.scope;
    }
    if (body?.channelId !== undefined) {
      const channelId = Number(body.channelId);
      if (!Number.isInteger(channelId) || channelId <= 0) {
        return NextResponse.json({ error: "Invalid channelId" }, { status: 400 });
      }
      scope = { channelId };
    }
    if (body?.publishedAfter) {
      // Expect YYYY-MM-DD from the admin page's date chooser. Reject anything
      // that is not a parseable date so a malformed request can't silently
      // widen or break the cutoff.
      const parsed = new Date(body.publishedAfter);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Invalid publishedAfter date" }, { status: 400 });
      }
      publishedAfter = body.publishedAfter;
    }
  } catch {
    // No body or invalid JSON — proceed without a custom cutoff
  }

  try {
    const result = await resyncYouTubeRounds(email, publishedAfter, scope);
    return NextResponse.json(result);
  } catch (error) {
    // Drizzle's wrapper message names only the SQL it ran, so the stack alone
    // left Workers Logs showing a failed query with no reason attached. Log
    // the flattened cause chain alongside the error itself, and hand the same
    // line to the admin page rather than the bare wrapper message.
    const details = describeError(error);
    console.error("Error resyncing YouTube rounds:", details, error);
    return NextResponse.json(
      { error: "Failed to resync videos", details },
      { status: 500 },
    );
  }
}

/** Recent resync history, newest first, for the admin page's status panel. */
export async function GET() {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = await getDBFromContext();
  const runs = await db
    .select()
    .from(youtubeSyncRuns)
    .orderBy(desc(youtubeSyncRuns.startedAt))
    .limit(10);

  return NextResponse.json({ runs });
}
