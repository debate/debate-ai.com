/**
 * @fileoverview A video's computed title: the standardized name a round is
 * listed and searched by, stored in `videos.computed_title` and shipped as
 * tuple slot 20.
 *
 * `"2026 Harvard Quarters: Iowa #6 Eltyeb & Weimar vs Emory #1 Gallagher & Young"`
 *
 * The year, tournament, format (for every format but college) and round,
 * then each team as its school, its rank in that season's rankings, its
 * debaters' full last names (else the code's initials), and the argument it
 * ran when known. The wording is {@link videoPageTitle}'s; this module adds
 * where the ranks and names come from when the title is stored (the fill in
 * the web app's `lib/videos/fill-computed-titles.ts`), and how the UI picks
 * the title to show.
 *
 * A lecture, or a video whose title doesn't read as a round, has no computed
 * title: its own title is what it's called.
 * @module lib/computed-title
 */

import type { VideoType } from "../types/videos"
import { videoPageTitle, type VideoPageTitleRanks } from "./video-page-title"

/** Tuple index of the stored computed title. */
export const VIDEO_COMPUTED_TITLE_SLOT = 20

/** The stored computed title, or null when the video has none yet. */
export function videoComputedTitle(video: VideoType | readonly unknown[] | null | undefined): string | null {
  const value = (video as readonly unknown[] | null | undefined)?.[VIDEO_COMPUTED_TITLE_SLOT]
  return typeof value === "string" && value.trim() !== "" ? value : null
}

/**
 * The computed title for `video` given what the rankings say about its teams,
 * or null when it is not a round (the title would just be its own).
 *
 * @param video - The video tuple.
 * @param ranks - Each team's rank and last names; see {@link VideoPageTitleRanks}.
 */
export function buildComputedTitle(video: VideoType, ranks: VideoPageTitleRanks = {}): string | null {
  const title = videoPageTitle(video, ranks)
  const own = typeof video[1] === "string" ? video[1] : ""
  return title && title.trim() !== own.trim() ? title : null
}

/**
 * The title the UI shows for `video`: the stored computed title, else one
 * built from the tuple alone (no ranks, initials for names) so a round added
 * since the last fill still reads the standard way, else the video's own.
 *
 * @param video - The video tuple.
 */
export function videoDisplayTitle(video: VideoType): string {
  return videoComputedTitle(video) ?? buildComputedTitle(video) ?? (typeof video[1] === "string" ? video[1] : "")
}
