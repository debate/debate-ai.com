/**
 * @fileoverview The Topic & Video Statistics page (`/videos/statistics`) —
 * combines the debate topics explorer with the YouTube channel statistics
 * charts, replacing the previously-modal-only stats display.
 * @module panels/statistics/StatisticsPage
 */

"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { YouTubeStatsCharts } from "../../components/youtube-stats-modal/YouTubeStatsCharts";
import { DebateTopicsExplorer, type YearVideoStats } from "../../components/topic-explorer/DebateTopicsExplorer";
import type { DebateTopicYear } from "../../lib/debate-topics";

export interface StatisticsPageProps {
  /** Every season's resolutions, from `LecturesPage`'s own `/api/videos/meta`
   *  fetch — passed down rather than fetched again here. */
  topics: DebateTopicYear[] | undefined;
  /** `/api/youtube-stats` response, or `null` while loading/unavailable —
   *  see {@link useYouTubeStats}. Also passed down from `LecturesPage`. */
  youtubeStats: unknown | null;
}

export function StatisticsPage({ topics, youtubeStats }: StatisticsPageProps) {
  // Same one-boundary cast as the charts below: the timeline only reads `byYear`.
  const videoStatsByYear = (youtubeStats as { byYear?: YearVideoStats[] } | null)?.byYear;

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6 flex flex-col justify-between">
      <div>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/videos"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background hover:bg-accent text-sm font-medium text-foreground transition-colors"
              aria-label="Back to videos"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </div>
        </div>

        <DebateTopicsExplorer topics={topics} videoStatsByYear={videoStatsByYear} />

        {youtubeStats ? (
          <div className="mt-10">
            {/* `useYouTubeStats`'s shape is only known to the modal/charts
                pair today (see YouTubeStatsCharts.tsx) — cast at this one
                boundary rather than duplicating that interface here. */}
            <YouTubeStatsCharts stats={youtubeStats as Parameters<typeof YouTubeStatsCharts>[0]["stats"]} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
