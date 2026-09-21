/**
 * @fileoverview The Topic & Video Statistics page — combines the debate topics
 * explorer with the YouTube channel statistics charts, replacing the
 * previously-modal-only stats display.
 * @module panels/statistics/StatisticsPage
 */

"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, TrendingUp, Users } from "lucide-react";
import { useYouTubeStats } from "../hooks/useYouTubeStats";
import { YouTubeStatsCharts } from "../components/youtube-stats-modal/YouTubeStatsCharts";
import { DebateTopicsExplorer } from "../components/topic-explorer/DebateTopicsExplorer";

export function StatisticsPage() {
  const youtubeStats = useYouTubeStats();

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

        <DebateTopicsExplorer />

        {youtubeStats && (
          <div className="mt-10">
            <YouTubeStatsCharts stats={youtubeStats} />
          </div>
        )}
      </div>
    </div>
  );
}