/**
 * @fileoverview Modal displaying YouTube statistics with charts
 */

"use client"

import { Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts"
import type { ChartConfig } from "@/components/ui/chart"

interface YouTubeStats {
  summary: {
    totalViews: number
    totalVideos: number
    totalChannels: number
    totalDebateStyles: number
  }
  byChannel: Array<{
    channel: string
    totalViews: number
    videoCount: number
    avgViewsPerVideo: number
  }>
  byDebateStyle: Array<{
    debateStyle: string
    totalViews: number
    videoCount: number
    avgViewsPerVideo: number
  }>
  byYear: Array<{
    year: string
    totalViews: number
    videoCount: number
    avgViewsPerVideo: number
  }>
  byElimRound?: Array<{
    round: string
    totalViews: number
    videoCount: number
    avgViewsPerVideo: number
  }>
}

const debateStyleLabels: Record<string, string> = {
  "1": "Policy",
  "2": "PF",
  "3": "LD",
  "4": "College",
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
} satisfies ChartConfig

export function YouTubeStatsModal({ stats }: { stats: YouTubeStats }) {
  // Prepare data for charts
  const topChannelsData = stats.byChannel
    .slice(0, 10)
    .map((ch) => ({
      name: ch.channel,
      views: ch.totalViews,
      videos: ch.videoCount,
      avgViews: ch.avgViewsPerVideo,
    }))

  const debateStyleData = stats.byDebateStyle.map((style) => ({
    name: debateStyleLabels[style.debateStyle] || `Style ${style.debateStyle}`,
    views: style.totalViews,
    videos: style.videoCount,
  }))

  // Filter years with significant data and recent years (2013-2025, excluding incomplete current year)
  const recentYears = (stats.byYear || [])
    .filter((y) => {
      const yearNum = parseInt(y.year)
      return !isNaN(yearNum) && yearNum >= 2013 && yearNum <= 2025
    })
    .map((y) => ({
      year: y.year,
      views: y.totalViews || 0,
      videos: y.videoCount || 0,
      avgViews: y.avgViewsPerVideo || 0,
    }))

  // Prepare elimination round data
  const elimRoundData = (stats.byElimRound || []).map((round) => ({
    name: round.round,
    views: round.totalViews,
    videos: round.videoCount,
    avgViews: round.avgViewsPerVideo,
  }))

  return (
    <TooltipProvider>
      <Dialog>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button className="shrink-0" variant="outline" size="icon">
                <Info className="h-4 w-4" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">YouTube stats & info</TooltipContent>
        </Tooltip>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>YouTube Statistics</DialogTitle>
            <DialogDescription>
              Comprehensive statistics from {stats.summary.totalChannels} YouTube channels
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-4">
            <div className="rounded-lg border p-3">
              <div className="text-2xl font-bold">{stats.summary.totalViews.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Total Views</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-2xl font-bold">{stats.summary.totalVideos.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Total Videos</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-2xl font-bold">{stats.summary.totalChannels}</div>
              <div className="text-xs text-muted-foreground">Channels</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-2xl font-bold">{stats.summary.totalDebateStyles}</div>
              <div className="text-xs text-muted-foreground">Debate Styles</div>
            </div>
          </div>

          <Tabs defaultValue="channels" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="channels">Top Channels</TabsTrigger>
              <TabsTrigger value="styles">By Style</TabsTrigger>
              <TabsTrigger value="rounds">Elim Rounds</TabsTrigger>
              <TabsTrigger value="years">By Year</TabsTrigger>
            </TabsList>

            <TabsContent value="channels" className="space-y-2">
              <div>
                <h3 className="text-sm font-medium mb-3">Views by Top Channels</h3>
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <BarChart data={topChannelsData} margin={{ top: 5, right: 10, left: 10, bottom: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      tick={{ fontSize: 8 }}
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 9 }} width={70} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="views" fill="var(--color-views)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-3">Avg Views per Video by Top Channels</h3>
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <BarChart data={topChannelsData} margin={{ top: 5, right: 10, left: 10, bottom: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      tick={{ fontSize: 8 }}
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 9 }} width={70} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="avgViews" fill="var(--color-avgViews)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            </TabsContent>

            <TabsContent value="rounds" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium mb-3">Views by Elimination Round</h3>
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <BarChart data={elimRoundData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 9 }} width={70} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="views" fill="var(--color-views)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-3">Avg Views per Video by Elim Round</h3>
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <BarChart data={elimRoundData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 9 }} width={70} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="avgViews" fill="var(--color-avgViews)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-3">Videos by Elimination Round</h3>
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                  <BarChart data={elimRoundData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 9 }} width={50} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="videos" fill="var(--color-videos)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            </TabsContent>

            <TabsContent value="styles" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium mb-3">Views by Debate Style</h3>
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <BarChart data={debateStyleData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 9 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="views" fill="var(--color-views)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-3">Videos by Debate Style</h3>
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <BarChart data={debateStyleData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 9 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="videos" fill="var(--color-videos)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="years" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium mb-3">Views Over Time (2013-2025)</h3>
                  <ChartContainer config={chartConfig} className="h-[220px] w-full">
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
                  <h3 className="text-sm font-medium mb-3">Videos Over Time (2013-2025)</h3>
                  <ChartContainer config={chartConfig} className="h-[220px] w-full">
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
              </div>
              <div>
                <h3 className="text-sm font-medium mb-3">Average Views per Video Over Time (2013-2025)</h3>
                <ChartContainer config={chartConfig} className="h-[220px] w-full">
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
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
