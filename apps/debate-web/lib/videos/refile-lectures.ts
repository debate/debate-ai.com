/**
 * @fileoverview Catch-up filing for lecture videos: moves Congressional Debate
 * lectures onto the Congress shelf and unplaced queued lectures onto
 * Miscellaneous.
 *
 * New videos land on the right shelf on their own (`ruleLectureCategory` in
 * the classifier, the detect and publish routes), so this is for rows stored
 * before. Idempotent: a row already on its shelf produces no write.
 *
 * Only lectures (`style` null) move. Congress rounds belong to the Congress
 * shelf by their style, and a round whose title says "Congress" is not a
 * lecture about it.
 *
 * Published lectures with no category or an unknown one are not rewritten:
 * they are counted and listed under Miscellaneous at read time, and their
 * stored category is part of the watch paths already shared.
 * @module lib/videos/refile-lectures
 */

import { count, eq, like, or } from "drizzle-orm";
import { normalizeCategoryKey } from "@debate-ai/videos/src/data/video-rows";
import {
  CONGRESS_LECTURE_CATEGORY,
  isLectureCategory,
  MISCELLANEOUS_CATEGORY,
  ruleLectureCategory,
} from "@debate-ai/videos/src/data/lecture-classifier";
import { chunkStatements } from "@/lib/database/query-budget";
import { videos, youtubeRoundVideos } from "@/lib/database/schema";
import { clearLibraryTotals } from "./admin-library";
import { recomputeVideoStacks } from "./recompute-video-stacks";
import { unsortedLectureCondition } from "./unsorted-lecture";

/** A video the re-file moved (or, in a dry run, would move). */
export interface RefiledSample {
  id: string;
  title: string;
  channel: string;
  where: "queued" | "published";
}

export interface RefileLecturesResult {
  dryRun: boolean;
  congress: {
    queued: number;
    published: number;
    /** Up to {@link SAMPLE_SIZE} of the videos matched, queued ones first. */
    samples: RefiledSample[];
  };
  miscellaneous: {
    /** Queued lectures with no valid category, moved onto the shelf. */
    queued: number;
    /** Published lectures with no or an unknown category, listed there at read time. */
    publishedUnsorted: number;
  };
}

const SAMPLE_SIZE = 15;
const CONGRESS_KEY = normalizeCategoryKey(CONGRESS_LECTURE_CATEGORY);

/** SQL pre-filter, a superset of the Congress rule; the exact rule re-checks each row. */
const CONGRESS_LIKE = "%congress%";

/**
 * Re-files lectures onto the Congress and Miscellaneous shelves.
 *
 * @param db - Drizzle handle bound to D1 (or local SQLite in development).
 * @param options.dryRun - Count and sample the matches without writing.
 */
export async function refileLectures(db: any, options: { dryRun?: boolean } = {}): Promise<RefileLecturesResult> {
  const dryRun = options.dryRun === true;

  const queuedCongressRows: { id: string; title: string; channel: string; description: string; category: string | null }[] =
    await db
      .select({
        id: youtubeRoundVideos.id,
        title: youtubeRoundVideos.title,
        channel: youtubeRoundVideos.channel,
        description: youtubeRoundVideos.description,
        category: youtubeRoundVideos.category,
        style: youtubeRoundVideos.style,
      })
      .from(youtubeRoundVideos)
      .where(
        or(
          like(youtubeRoundVideos.title, CONGRESS_LIKE),
          like(youtubeRoundVideos.channel, CONGRESS_LIKE),
          like(youtubeRoundVideos.description, CONGRESS_LIKE),
        ),
      )
      .then((rows: any[]) => rows.filter((row) => row.style == null));
  const queuedCongress = queuedCongressRows.filter(
    (row) =>
      ruleLectureCategory(row.title, row.description, row.channel) === CONGRESS_LECTURE_CATEGORY &&
      row.category !== CONGRESS_LECTURE_CATEGORY,
  );

  const publishedCongressRows: {
    videoId: string;
    title: string;
    channel: string;
    description: string;
    category: string | null;
  }[] = await db
    .select({
      videoId: videos.videoId,
      title: videos.title,
      channel: videos.channel,
      description: videos.description,
      category: videos.category,
      style: videos.style,
    })
    .from(videos)
    .where(or(like(videos.title, CONGRESS_LIKE), like(videos.channel, CONGRESS_LIKE), like(videos.description, CONGRESS_LIKE)))
    .then((rows: any[]) => rows.filter((row) => row.style == null));
  const publishedCongress = publishedCongressRows.filter(
    (row) =>
      ruleLectureCategory(row.title, row.description, row.channel) === CONGRESS_LECTURE_CATEGORY &&
      row.category !== CONGRESS_LECTURE_CATEGORY,
  );

  const queuedLectures: { id: string; category: string | null; style: number | null }[] = await db
    .select({ id: youtubeRoundVideos.id, category: youtubeRoundVideos.category, style: youtubeRoundVideos.style })
    .from(youtubeRoundVideos);
  const congressIds = new Set(queuedCongress.map((row) => row.id));
  const queuedMisc = queuedLectures.filter(
    (row) => row.style == null && !isLectureCategory(row.category) && !congressIds.has(row.id),
  );

  const [{ value: publishedUnsorted } = { value: 0 }] = await db
    .select({ value: count() })
    .from(videos)
    .where(unsortedLectureCondition());

  if (!dryRun) {
    const now = new Date();
    const writes = [
      ...queuedCongress.map((row) =>
        db
          .update(youtubeRoundVideos)
          .set({ category: CONGRESS_LECTURE_CATEGORY, updatedAt: now })
          .where(eq(youtubeRoundVideos.id, row.id)),
      ),
      ...queuedMisc.map((row) =>
        db
          .update(youtubeRoundVideos)
          .set({ category: MISCELLANEOUS_CATEGORY, updatedAt: now })
          .where(eq(youtubeRoundVideos.id, row.id)),
      ),
      ...publishedCongress.map((row) =>
        db
          .update(videos)
          .set({ category: CONGRESS_LECTURE_CATEGORY, categoryKey: CONGRESS_KEY, updatedAt: now })
          .where(eq(videos.videoId, row.videoId)),
      ),
    ];
    for (const batch of chunkStatements(writes)) await db.batch(batch);
    if (publishedCongress.length > 0) {
      clearLibraryTotals();
      await recomputeVideoStacks(db);
    }
  }

  const samples: RefiledSample[] = [
    ...queuedCongress.map((row) => ({ id: row.id, title: row.title, channel: row.channel, where: "queued" as const })),
    ...publishedCongress.map((row) => ({ id: row.videoId, title: row.title, channel: row.channel, where: "published" as const })),
  ].slice(0, SAMPLE_SIZE);

  return {
    dryRun,
    congress: { queued: queuedCongress.length, published: publishedCongress.length, samples },
    miscellaneous: { queued: queuedMisc.length, publishedUnsorted },
  };
}
