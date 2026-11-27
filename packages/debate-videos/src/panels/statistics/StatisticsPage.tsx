/**
 * @fileoverview The Topics & Statistics page (`/practice/statistics`) —
 * stacked sections over the same subject: the debate topics by year (first,
 * from `topics` plus the pre-2000 legacy seasons), the topic-area research breakdown, and the YouTube channel
 * statistics charts (the totals charts four to a row), plus a searchable
 * section of 700 philosophical value resolutions, replacing the
 * previously-modal-only stats display, and — at the very bottom — the
 * championship side bias per format over the last ten seasons.
 * @module panels/statistics/StatisticsPage
 */

"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { YouTubeStatsCharts } from "../../components/videos/youtube-stats/YouTubeStatsCharts";
import { DebateTopicsExplorer, type YearVideoStats } from "../../components/topic-explorer/DebateTopicsExplorer";
import { TopicAreasExplorer } from "../../components/topic-explorer/TopicAreasExplorer";
import { ValueResolutionsExplorer } from "../../components/topic-explorer/ValueResolutionsExplorer";
import { SideBiasChart } from "../../components/topic-explorer/SideBiasChart";
import type { DebateTopicYear } from "@debate-ai/rankings/src/topics/debate-topics";
import { sideBiasSeries, type SideBiasSeries } from "@debate-ai/rankings/src/side-bias";
import { currentRankingSeasonYear } from "@debate-ai/rankings/src/extinction";
import { withLegacyTopicYears } from "@debate-ai/rankings/src/topics/legacy-topics";

export interface StatisticsPageProps {
  /** Every season's resolutions, from `LecturesPage`'s own `/api/videos/meta`
   *  fetch — passed down rather than fetched again here. */
  topics: DebateTopicYear[] | undefined;
  /** `/api/youtube-stats` response, or `null` while loading/unavailable —
   *  see {@link useYouTubeStats}. Also passed down from `LecturesPage`. */
  youtubeStats: unknown | null;
  /**
   * The research-area topic explorer, rendered right after the topics by year.
   *
   * A slot rather than a direct import: the 44 research-area definitions and
   * their resolutions live in `debate-webview`, which depends on this package,
   * not the reverse — so `debate-videos` cannot import the explorer itself.
   * The host page mounts it and hands the element down, the same way `dockSlot`
   * carries the app dock into the video library.
   */
  topicAreasSlot?: ReactNode;
  /** Championship side bias per format, for the closing chart; defaults to the bundled last ten seasons. */
  sideBias?: SideBiasSeries[];
}

export function StatisticsPage({ topics, youtubeStats, topicAreasSlot, sideBias }: StatisticsPageProps) {
  const sideBiasRows = useMemo(() => sideBias ?? sideBiasSeries(currentRankingSeasonYear()), [sideBias]);
  // Same one-boundary cast as the charts below: the timeline only reads `byYear`.
  const videoStatsByYear = (youtubeStats as { byYear?: YearVideoStats[] } | null)?.byYear;
  // The pre-2000 policy and LD seasons are listed here too: the Topic Starters
  // dropdown stops at 2015 and sends readers here for anything older.
  const allTopics = useMemo(() => (topics ? withLegacyTopicYears(topics) : undefined), [topics]);

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

        <div className="mb-10">
          <DebateTopicsExplorer topics={allTopics} videoStatsByYear={videoStatsByYear} />
        </div>

        {topicAreasSlot ? (
          <div className="mb-10">{topicAreasSlot}</div>
        ) : null}

        <section>
          <h2 className="mb-4 text-lg font-semibold">Topic Areas by Research Domain</h2>
          <TopicAreasExplorer />
        </section>

        <section id="value-resolutions" className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">700 Philosophical Resolutions</h2>
          <ValueResolutionsExplorer />
        </section>

        {youtubeStats ? (
          <div className="mt-10">
            {/* `useYouTubeStats`'s shape is only known to the modal/charts
                pair today (see YouTubeStatsCharts.tsx) — cast at this one
                boundary rather than duplicating that interface here. */}
            <YouTubeStatsCharts stats={youtubeStats as Parameters<typeof YouTubeStatsCharts>[0]["stats"]} />
          </div>
        ) : null}

        <div className="mt-10">
          <SideBiasChart series={sideBiasRows} />
        </div>
      </div>
    </div>
  );
}
