/**
 * @fileoverview SQL for the lectures that are unsorted: no debate style, and no
 * category or one that is not a known shelf (see `isUnsortedLecture`). They are
 * listed and counted under Miscellaneous at read time.
 * @module lib/videos/unsorted-lecture
 */

import { and, isNull, or, sql, type SQL } from "drizzle-orm";
import { KNOWN_LECTURE_CATEGORY_KEYS } from "@debate-ai/videos/src/data/video-rows";
import { videos } from "@/lib/database/schema";

/**
 * The known keys are fixed slugs, inlined rather than bound so the list does
 * not eat into D1's bound-parameter budget.
 */
export function unsortedLectureCondition(): SQL {
  const known = sql.raw(KNOWN_LECTURE_CATEGORY_KEYS.map((key) => `'${key.replace(/'/g, "''")}'`).join(", "));
  return and(isNull(videos.style), or(isNull(videos.categoryKey), sql`${videos.categoryKey} NOT IN (${known})`))!;
}
