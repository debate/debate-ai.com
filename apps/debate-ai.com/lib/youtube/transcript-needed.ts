/**
 * @fileoverview Files a "Needs transcript" report for a video YouTube has no
 * captions for, so it lands in the admin Reports panel instead of only in the
 * worker logs.
 *
 * The report is an ordinary `video_issues` row of kind `transcript`, filed by
 * nobody (`reportedBy` null), which is what lets the panel list it beside
 * viewer reports and resolve it the same way. An admin answers it by adding a
 * transcript document to the video — YouTube's captions will still be missing
 * afterwards, which is why a video is flagged at most once, ever: a dismissed
 * or applied report is not refiled on the next view.
 *
 * Best-effort like the transcript cache: nothing here may turn a transcript
 * request into an error.
 */

import { and, eq } from "drizzle-orm";
import { getDBFromContext } from "@/lib/database/context";
import { videoDocuments, videoIssues, videos } from "@/lib/database/schema";

/** The `video_issues.kind` these reports are filed under. */
export const TRANSCRIPT_ISSUE_KIND = "transcript";

/**
 * Flags `videoId` as needing a transcript, unless it already has been.
 *
 * @param reason - What went wrong, shown to the admin: no captions, or a
 *   fetch failure that was not YouTube's bot check.
 */
export async function flagMissingTranscript(videoId: string, reason: string): Promise<void> {
  try {
    const db = await getDBFromContext();
    // One row per video, keyed so that two viewers opening it at once cannot
    // both file it.
    const id = `${TRANSCRIPT_ISSUE_KIND}:${videoId}`;
    const [existing] = await db
      .select({ id: videoIssues.id })
      .from(videoIssues)
      .where(eq(videoIssues.id, id))
      .limit(1);
    if (existing) return;

    // Only videos the library holds are worth an admin's time; a transcript
    // request for an arbitrary id is not a library gap.
    const [video] = await db
      .select({ title: videos.title })
      .from(videos)
      .where(eq(videos.videoId, videoId))
      .limit(1);
    if (!video) return;

    // An editor's transcript already covers it; the captions are not missed.
    const [document] = await db
      .select({ videoId: videoDocuments.videoId })
      .from(videoDocuments)
      .where(and(eq(videoDocuments.videoId, videoId), eq(videoDocuments.kind, "transcript")))
      .limit(1);
    if (document) return;

    await db
      .insert(videoIssues)
      .values({
        id,
        videoId,
        title: video.title,
        kind: TRANSCRIPT_ISSUE_KIND,
        issue: reason,
        reportedBy: null,
        status: "open",
        createdAt: new Date(),
      })
      .onConflictDoNothing();
  } catch (error) {
    console.warn(`Could not flag ${videoId} as needing a transcript:`, error);
  }
}
