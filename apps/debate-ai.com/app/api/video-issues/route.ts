import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { isLectureCategory } from "@debate/data-sync/src/youtube/parsers/lecture-classifier";
import { getAdminEmails, getStaffAccess } from "@/lib/auth/admin";
import { getSession } from "@/lib/auth/session";
import { getDBFromContext } from "@/lib/database/context";
import { videoIssues } from "@/lib/database/schema";
import {
  MAX_CHANGE_REQUEST_LENGTH,
  notifyVideoModerators,
  sanitizeProposedChanges,
} from "@/lib/videos/video-change-requests";

/**
 * Viewer reports about a video — a dead embed, a bad transcript, and above
 * all a miscategorised one.
 *
 * This route used to append to `data/video-issues/issues.json` with
 * `fs.writeFile`. Cloudflare's filesystem is read-only, so in production
 * every report 500'd on the write and nothing was ever stored; the reports
 * that appeared to submit were the ones the dialog kept in the reporter's own
 * browser. They are rows now.
 *
 * A miscategorised report carries the correction as structured fields rather
 * than prose — the debate style, the lecture category, or the competition
 * level — so an admin can read what it should be instead of guessing from a
 * sentence.
 *
 * `edit` and `delete` are change requests from the watch page's edit button
 * (see `lib/videos/video-change-requests.ts`): an edit carries the proposed
 * fields as JSON in `issue`, and both ping every moderator. They need a
 * signed-in account, so a request always names who asked for it.
 */

/** YouTube ids are exactly 11 characters from this alphabet. */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** What a report can be about. */
const ISSUE_KINDS = [
  "miscategorized",
  "unavailable",
  "quality",
  "metadata",
  "transcript",
  "edit",
  "delete",
  "other",
] as const;

/** Competition levels a miscategorised round can be moved between. */
export const ROUND_LEVELS = ["college", "high-school", "middle-school"] as const;

/** Numeric debate styles, matching `videos.style`. */
const STYLES = [1, 2, 3, 4];

/** Longest free-text report accepted. */
const MAX_ISSUE_LENGTH = 2000;

/** Narrows a value to one of the report kinds. */
function isIssueKind(value: unknown): value is (typeof ISSUE_KINDS)[number] {
  return typeof value === "string" && (ISSUE_KINDS as readonly string[]).includes(value);
}

/**
 * Files a report.
 *
 * Open to signed-out viewers, because the people who spot a miscategorised
 * video are usually browsing rather than logged in — the account email is
 * recorded when there is one, so a follow-up is possible, and left null
 * otherwise.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const videoId = String(body?.videoId ?? "").trim();
  if (!VIDEO_ID_RE.test(videoId)) {
    return NextResponse.json({ error: "videoId must be a YouTube video id" }, { status: 400 });
  }

  const kind = isIssueKind(body?.kind) ? body.kind : "other";
  const title = String(body?.title ?? "").trim().slice(0, 300);

  if (kind === "edit" || kind === "delete") {
    return fileChangeRequest(kind, videoId, title, body);
  }

  const issue = String(body?.issue ?? "").trim().slice(0, MAX_ISSUE_LENGTH);

  // A report has to say *something*: either prose, or a correction a
  // miscategorised report carries in its own fields.
  const styleValue = Number(body?.suggestedStyle);
  const suggestedStyle = STYLES.includes(styleValue) ? styleValue : null;
  const suggestedCategory = isLectureCategory(body?.suggestedCategory)
    ? (body.suggestedCategory as string)
    : null;
  const levelValue = String(body?.suggestedRoundLevel ?? "").trim();
  const suggestedRoundLevel = (ROUND_LEVELS as readonly string[]).includes(levelValue)
    ? levelValue
    : null;

  if (!issue && !suggestedStyle && !suggestedCategory && !suggestedRoundLevel) {
    return NextResponse.json(
      { error: "Say what is wrong, or choose the correct category" },
      { status: 400 },
    );
  }

  try {
    const session = await getSession();
    const db = await getDBFromContext();

    const row = {
      id: crypto.randomUUID(),
      videoId,
      title,
      kind,
      issue,
      suggestedStyle,
      suggestedCategory,
      suggestedRoundLevel,
      reportedBy: session?.user?.email?.toLowerCase() ?? null,
      status: "open",
      createdAt: new Date(),
    };

    await db.insert(videoIssues).values(row);
    return NextResponse.json({ success: true, id: row.id });
  } catch (error) {
    console.error("Failed to save video issue:", error);
    return NextResponse.json({ error: "Failed to save issue" }, { status: 500 });
  }
}

/**
 * Files an `edit` or `delete` change request and pings the moderators. The
 * video is untouched until one of them applies it from the admin panel.
 */
async function fileChangeRequest(
  kind: "edit" | "delete",
  videoId: string,
  title: string,
  body: Record<string, unknown>,
) {
  const session = await getSession();
  const email = session?.user?.email?.toLowerCase() ?? null;
  if (!email) {
    return NextResponse.json({ error: "Sign in to suggest a change" }, { status: 401 });
  }

  const reason = String(body?.reason ?? "").trim().slice(0, MAX_ISSUE_LENGTH);
  let issue = reason;
  if (kind === "edit") {
    const changes = sanitizeProposedChanges(body?.proposedChanges);
    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ error: "Change at least one field first" }, { status: 400 });
    }
    issue = JSON.stringify({ changes, reason });
    if (issue.length > MAX_CHANGE_REQUEST_LENGTH) {
      return NextResponse.json({ error: "That change is too long to submit" }, { status: 400 });
    }
  }

  try {
    const db = await getDBFromContext();
    const id = crypto.randomUUID();
    await db.insert(videoIssues).values({
      id,
      videoId,
      title,
      kind,
      issue,
      suggestedStyle: null,
      suggestedCategory: null,
      suggestedRoundLevel: null,
      reportedBy: email,
      status: "open",
      createdAt: new Date(),
    });

    await notifyVideoModerators(db, getAdminEmails(), {
      title: kind === "delete" ? "Video deletion requested" : "Video edit suggested",
      body: `${email} ${kind === "delete" ? "asked to delete" : "suggested changes to"} “${title || videoId}”. Review it under Reports on the admin panel.`,
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Failed to save video change request:", error);
    return NextResponse.json({ error: "Failed to submit your request" }, { status: 500 });
  }
}

/**
 * Lists reports for the admin page — `?status=open` by default, `?videoId=`
 * to see one video's history.
 *
 * Admins and moderators only: reports carry the reporter's email, and reading someone else's
 * complaint about a video is not a public capability.
 */
export async function GET(request: NextRequest) {
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "open";
  const videoId = searchParams.get("videoId");
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 100, 1), 500);

  try {
    const db = await getDBFromContext();

    const conditions: SQL[] = [];
    if (status !== "all") conditions.push(eq(videoIssues.status, status));
    if (videoId) conditions.push(eq(videoIssues.videoId, videoId));
    const where =
      conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);

    const issues = await db
      .select()
      .from(videoIssues)
      .where(where)
      .orderBy(desc(videoIssues.createdAt))
      .limit(limit);

    return NextResponse.json({ issues });
  } catch (error) {
    console.error("Failed to read video issues:", error);
    // An unseeded database is not an error for the admin page — it simply has
    // no reports yet.
    return NextResponse.json({ issues: [] });
  }
}

/** Resolves a report: `{ id, status: "applied" | "dismissed" | "open" }`. */
export async function PATCH(request: NextRequest) {
  const { canEditContent, email } = await getStaffAccess();
  if (!canEditContent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { id?: unknown; status?: unknown };
  try {
    body = (await request.json()) as { id?: unknown; status?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = String(body?.id ?? "").trim();
  const status = String(body?.status ?? "").trim();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  if (!["open", "applied", "dismissed"].includes(status)) {
    return NextResponse.json(
      { error: "status must be open, applied or dismissed" },
      { status: 400 },
    );
  }

  try {
    const db = await getDBFromContext();
    await db
      .update(videoIssues)
      .set({
        status,
        resolvedBy: status === "open" ? null : email,
        resolvedAt: status === "open" ? null : new Date(),
      })
      .where(eq(videoIssues.id, id));
    return NextResponse.json({ ok: true, id, status });
  } catch (error) {
    console.error("Failed to update video issue:", error);
    return NextResponse.json(
      { error: "Failed to update issue", details: (error as Error).message },
      { status: 500 },
    );
  }
}
