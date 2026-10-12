/**
 * @fileoverview Bulk fix for videos the title parsers filed under the wrong
 * debate style — e.g. every "Dartmouth RR" round, which is college but whose
 * titles carry no "college"/"NDT" keyword, so `parseDebateStyle` fell back to
 * Policy.
 *
 * For every published video whose title contains `match`, this sets `style`
 * and (optionally) re-runs the same model extraction the admin form's
 * "Auto-fill with AI" uses (`askModel` in `video-autofill.ts`) over the
 * stored title, channel and description, writing back the round fields it
 * finds: tournament, round, teams, winner, decision, speech docs. A field the
 * model leaves empty keeps its stored value rather than being blanked.
 *
 * Writes go through {@link updateLibraryVideo}, so the rows are marked
 * `admin_edited` and a later JSON re-seed won't revert them. Rows still in the
 * unpublished round queue get the style change too, so publishing them later
 * doesn't bring the old style back.
 *
 * Work is paged by `video_id` (`after` + `limit`) because each model call is a
 * subrequest and a Worker caps those per request; the caller loops on
 * `nextCursor` until it is `null`.
 * @module lib/videos/reclassify-by-title
 */

import { and, asc, gt, sql } from "drizzle-orm";
import { videos, youtubeRoundVideos } from "@/lib/database/schema";
import { updateLibraryVideo, type LibraryVideoPatch } from "./admin-library";
import { askModel, buildAutofillContent, type AutofillFields } from "./video-autofill";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/** Round fields copied from the model's answer when it has one. */
const ROUND_FIELDS = [
  "tournament",
  "roundLevel",
  "affTeam",
  "negTeam",
  "affWin",
  "judgeDecision",
  "speechDocsUrl",
] as const;

export interface ReclassifyByTitleOptions {
  /** Case-insensitive substring the title must contain, e.g. `Dartmouth RR`. */
  match: string;
  /** Numeric debate style to set (1 Policy, 2 PF, 3 LD, 4 College). */
  style: number;
  /** Re-run the model's round-info extraction on each matched video. */
  parseRoundInfo?: boolean;
  /** Resume after this `video_id` (the previous call's `nextCursor`). */
  after?: string | null;
  limit?: number;
}

export interface ReclassifyByTitleResult {
  /** Published videos this page touched. */
  updated: Array<{ videoId: string; title: string; fields: LibraryVideoPatch }>;
  /** Videos whose model call failed; they still got the style change. */
  failed: Array<{ videoId: string; error: string }>;
  /** Unpublished queue rows whose style was changed (first page only). */
  queueUpdated: number;
  /** Pass as `after` to continue, or `null` when every match is done. */
  nextCursor: string | null;
}

/** Escapes the LIKE wildcards so a literal `%` or `_` matches as itself. */
function likePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

/** The model's round fields that carry a value, as a library patch. */
export function roundInfoPatch(fields: AutofillFields): LibraryVideoPatch {
  const patch: LibraryVideoPatch = {};
  for (const field of ROUND_FIELDS) {
    const value = fields[field];
    if (value !== null && value !== undefined) patch[field] = value;
  }
  return patch;
}

/**
 * Reclassifies one page of matching videos.
 *
 * @param db - Drizzle handle bound to D1 (or SQLite in tests).
 * @param options - What to match, what to set, and where to resume.
 * @param ask - The model call; injectable for tests.
 */
export async function reclassifyVideosByTitle(
  db: any,
  options: ReclassifyByTitleOptions,
  ask: (content: string) => Promise<AutofillFields> = askModel,
): Promise<ReclassifyByTitleResult> {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const pattern = likePattern(options.match.trim());
  const titleMatches = sql`${videos.title} LIKE ${pattern} ESCAPE '\\'`;

  const rows: Array<{ videoId: string; title: string; channel: string; description: string }> =
    await db
      .select({
        videoId: videos.videoId,
        title: videos.title,
        channel: videos.channel,
        description: videos.description,
      })
      .from(videos)
      .where(options.after ? and(titleMatches, gt(videos.videoId, options.after)) : titleMatches)
      .orderBy(asc(videos.videoId))
      .limit(limit + 1);

  const page = rows.slice(0, limit);
  const result: ReclassifyByTitleResult = {
    updated: [],
    failed: [],
    queueUpdated: 0,
    nextCursor: rows.length > limit ? page[page.length - 1].videoId : null,
  };

  for (const row of page) {
    const patch: LibraryVideoPatch = { style: options.style };
    if (options.parseRoundInfo) {
      try {
        const fields = await ask(
          buildAutofillContent({ title: row.title, channel: row.channel, description: row.description }),
        );
        Object.assign(patch, roundInfoPatch(fields));
      } catch (error) {
        result.failed.push({
          videoId: row.videoId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    await updateLibraryVideo(db, row.videoId, patch);
    result.updated.push({ videoId: row.videoId, title: row.title, fields: patch });
  }

  // The queue is one cheap UPDATE, so do it once, on the first page.
  if (!options.after) {
    const queued = await db
      .update(youtubeRoundVideos)
      .set({ style: options.style, updatedAt: new Date() })
      .where(sql`${youtubeRoundVideos.title} LIKE ${pattern} ESCAPE '\\'`)
      .returning({ id: youtubeRoundVideos.id });
    result.queueUpdated = queued.length;
  }

  return result;
}
