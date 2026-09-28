/**
 * @fileoverview Reusable YouTube statistics charts, extracted from
 * `YouTubeStatsModal` so they can render on a standalone page.
 * @module components/youtube-stats-modal/YouTubeStatsCharts
 */

"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/primitives/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../../ui/charts/chart";
import type { ChartConfig } from "../../ui/charts/chart";

interface YouTubeStats {
  summary: {
    totalViews: number;
    totalVideos: number;
    totalChannels: number;
    totalDebateStyles: number;
  };
  byChannel: Array<{
    channel: string;
    totalViews: number;
    videoCount: number;
    avgViewsPerVideo: number;
  }>;
  byDebateStyle: Array<{
    debateStyle: string;
    totalViews: number;
    videoCount: number;
    avgViewsPerVideo: number;
  }>;
  byYear: Array<{
    year: string;
    totalViews: number;
    videoCount: number;
    avgViewsPerVideo: number;
  }>;
  byElimRound?: Array<{
    round: string;
    totalViews: number;
    videoCount: number;
    avgViewsPerVideo: number;
  }>;
}

const chartConfig = {
  views: {
    label: "Views",
    color: "hsl(220, 70%, 50%)",
  },
  videos: {
    label: "Videos",
    color: "hsl(142, 76%, 45%)",
  },
  avgViews: {
    label: "Avg Views",
    color: "hsl(280, 65%, 55%)",
  },
} satisfies ChartConfig;

export function YouTubeStatsCharts({ stats }: { stats: YouTubeStats }) {
  const topChannelsData = stats.byChannel
    .slice(0, 20)
    .map((ch) => ({
      name: ch.channel,
      views: ch.totalViews,
      videos: ch.videoCount,
      avgViews: ch.avgViewsPerVideo,
    }));

  const recentYears = (stats.byYear || [])
    .filter((y) => {
      const yearNum = parseInt(y.year);
      return !isNaN(yearNum) && yearNum >= 2013 && yearNum <= 2025;
    })
    .map((y) => ({
      year: y.year,
      views: y.totalViews || 0,
      videos: y.videoCount || 0,
      avgViews: y.avgViewsPerVideo || 0,
    }));

  const elimRoundData = (stats.byElimRound || []).map((round) => ({
    name: round.round,
    views: round.totalViews,
    videos: round.videoCount,
    avgViews: round.avgViewsPerVideo,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">YouTube Channel Statistics</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead className="text-right">Total Views</TableHead>
                <TableHead className="text-right">Videos</TableHead>
                <TableHead className="text-right">Avg Views/Video</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topChannelsData.map((channel, index) => (
                <TableRow key={channel.name}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>{channel.name}</TableCell>
                  <TableCell className="text-right">{channel.views.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{channel.videos.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{channel.avgViews.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Views Over Time (2013-2025)</h2>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <LineChart data={recentYears} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} width={60} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="views"
              stroke="var(--color-views)"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ChartContainer>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Videos Over Time (2013-2025)</h2>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <LineChart data={recentYears} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} width={40} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="videos"
              stroke="var(--color-videos)"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ChartContainer>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Average Views per Video Over Time (2013-2025)</h2>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <LineChart data={recentYears} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} width={60} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="avgViews"
              stroke="var(--color-avgViews)"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ChartContainer>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Avg Views per Video by Elim Round</h2>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={elimRoundData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 9 }} width={60} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="avgViews" fill="var(--color-avgViews)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
}