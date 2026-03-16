/**
 * @fileoverview Modal displaying YouTube statistics with charts
 */

"use client"

import { Info, RefreshCw } from "lucide-react"
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
import { useState } from "react"
import type { VideoType } from "@/lib/types/videos"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

// Helper function to calculate stats from video data
function calculateStatsFromVideos(videos: VideoType[]): YouTubeStats {
  const statsByChannel: Record<string, { totalViews: number; videoCount: number }> = {}
  const statsByDebateStyle: Record<string, { totalViews: number; videoCount: number }> = {}
  const statsByYear: Record<string, { totalViews: number; videoCount: number }> = {}
  const statsByElimRound: Record<string, { totalViews: number; videoCount: number }> = {}

  const normalizeElimRound = (roundName: string): string | null => {
    const lower = roundName.toLowerCase()
    if (lower.includes('final') && !lower.includes('semi')) return 'Finals'
    if (lower.includes('semi')) return 'Semifinals'
    if (lower.includes('quarter')) return 'Quarterfinals'
    if (lower.includes('octa') || lower.includes('octo')) return 'Octafinals'
    if (lower.includes('double')) return 'Double Octafinals'
    return null
  }

  for (const video of videos) {
    const channel = video[3]
    const views = Number(video[4]) || 0
    const debateStyle = video[6] || "unknown"
    const date = video[2]
    const year = date ? date.split("-")[0] : "unknown"
    const roundName = video[8]

    if (!statsByChannel[channel]) {
      statsByChannel[channel] = { totalViews: 0, videoCount: 0 }
    }
    statsByChannel[channel].totalViews += views
    statsByChannel[channel].videoCount += 1

    // Handle debateStyle - can be a number (1-4) or a string (for lectures)
    const styleLabel = typeof debateStyle === 'number'
      ? (debateStyle === 1 ? "Policy" : debateStyle === 2 ? "Public Forum" : debateStyle === 3 ? "Lincoln-Douglas" : debateStyle === 4 ? "College Policy" : "Unknown")
      : String(debateStyle)

    if (!statsByDebateStyle[styleLabel]) {
      statsByDebateStyle[styleLabel] = { totalViews: 0, videoCount: 0 }
    }
    statsByDebateStyle[styleLabel].totalViews += views
    statsByDebateStyle[styleLabel].videoCount += 1

    if (!statsByYear[year]) {
      statsByYear[year] = { totalViews: 0, videoCount: 0 }
    }
    statsByYear[year].totalViews += views
    statsByYear[year].videoCount += 1

    if (roundName) {
      const normalizedRound = normalizeElimRound(roundName)
      if (normalizedRound) {
        if (!statsByElimRound[normalizedRound]) {
          statsByElimRound[normalizedRound] = { totalViews: 0, videoCount: 0 }
        }
        statsByElimRound[normalizedRound].totalViews += views
        statsByElimRound[normalizedRound].videoCount += 1
      }
    }
  }

  const totalViews = Object.values(statsByChannel).reduce((sum, ch) => sum + ch.totalViews, 0)
  const totalVideos = Object.values(statsByChannel).reduce((sum, ch) => sum + ch.videoCount, 0)

  const channelsSorted = Object.entries(statsByChannel)
    .sort(([, a], [, b]) => b.totalViews - a.totalViews)
    .map(([channel, stats]) => ({
      channel,
      totalViews: stats.totalViews,
      videoCount: stats.videoCount,
      avgViewsPerVideo: Math.round(stats.totalViews / stats.videoCount),
    }))

  const debateStylesSorted = Object.entries(statsByDebateStyle)
    .sort(([, a], [, b]) => b.totalViews - a.totalViews)
    .map(([debateStyle, stats]) => ({
      debateStyle,
      totalViews: stats.totalViews,
      videoCount: stats.videoCount,
      avgViewsPerVideo: Math.round(stats.totalViews / stats.videoCount),
    }))

  const yearsSorted = Object.entries(statsByYear)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, stats]) => ({
      year,
      totalViews: stats.totalViews,
      videoCount: stats.videoCount,
      avgViewsPerVideo: Math.round(stats.totalViews / stats.videoCount),
    }))

  const elimRoundOrder = ['Finals', 'Semifinals', 'Quarterfinals', 'Octafinals', 'Double Octafinals']
  const elimRoundsSorted = elimRoundOrder
    .filter(round => statsByElimRound[round])
    .map((round) => ({
      round,
      totalViews: statsByElimRound[round].totalViews,
      videoCount: statsByElimRound[round].videoCount,
      avgViewsPerVideo: Math.round(statsByElimRound[round].totalViews / statsByElimRound[round].videoCount),
    }))

  return {
    summary: {
      totalViews,
      totalVideos,
      totalChannels: channelsSorted.length,
      totalDebateStyles: debateStylesSorted.length,
    },
    byChannel: channelsSorted,
    byDebateStyle: debateStylesSorted,
    byYear: yearsSorted,
    byElimRound: elimRoundsSorted,
  }
}

export function YouTubeStatsModal({ stats: initialStats, allVideos }: { stats: YouTubeStats; allVideos?: VideoType[] }) {
  const [stats, setStats] = useState(initialStats)
  const [isRecalculating, setIsRecalculating] = useState(false)

  const handleRecalculate = async () => {
    if (!allVideos || allVideos.length === 0) {
      console.error("No videos available for recalculation")
      return
    }

    setIsRecalculating(true)
    try {
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 100))
      const newStats = calculateStatsFromVideos(allVideos)
      setStats(newStats)
    } catch (error) {
      console.error("Failed to recalculate stats:", error)
    } finally {
      setIsRecalculating(false)
    }
  }
  // Prepare data for charts
  const topChannelsData = stats.byChannel
    .slice(0, 20)
    .map((ch) => ({
      name: ch.channel,
      views: ch.totalViews,
      videos: ch.videoCount,
      avgViews: ch.avgViewsPerVideo,
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
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>YouTube Statistics</DialogTitle>
                <DialogDescription>
                  Comprehensive statistics from {stats.summary.totalChannels} YouTube channels
                </DialogDescription>
              </div>
              {allVideos && allVideos.length > 0 && (
                <Button
                  onClick={handleRecalculate}
                  disabled={isRecalculating}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isRecalculating ? 'animate-spin' : ''}`} />
                  Recalculate
                </Button>
              )}
            </div>
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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="channels">Top Channels</TabsTrigger>
              <TabsTrigger value="rounds">Elim Rounds</TabsTrigger>
              <TabsTrigger value="years">By Year</TabsTrigger>
            </TabsList>

            <TabsContent value="channels" className="space-y-2">
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
