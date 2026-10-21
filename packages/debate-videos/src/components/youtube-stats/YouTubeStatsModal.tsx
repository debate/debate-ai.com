/**
 * @fileoverview Modal displaying YouTube statistics with charts
 */

"use client"

import { lazy, Suspense } from "react"
import { Info, Loader2 } from "lucide-react"
import { Button } from "../../ui/primitives/button"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "../../ui/primitives/dialog"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "../../ui/primitives/tooltip"
import type { YouTubeStats } from "./YouTubeStatsBody"

/** The charts, with recharts, load the first time the dialog opens. */
const YouTubeStatsBody = lazy(() => import("./YouTubeStatsBody"))

export function YouTubeStatsModal({
  stats,
  open,
  onOpenChange,
}: {
  stats: YouTubeStats
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={onOpenChange}>
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
          <Suspense
            fallback={
              <div className="flex h-48 items-center justify-center">
                <DialogTitle className="sr-only">YouTube Statistics</DialogTitle>
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <YouTubeStatsBody stats={stats} />
          </Suspense>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
