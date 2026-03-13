import { X, Minus, Maximize2, SkipForward, Play, Pause, Gauge } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import type { QueueItem } from "@/lib/state/videoPlayerStore"

interface PlayerControlsProps {
  isPlaying: boolean
  isMinimized: boolean
  isSlowMode: boolean
  queue: QueueItem[]
  onPlayPause: () => void
  onToggleSlowMode: () => void
  onPlayNext: () => void
  onToggleMinimize: () => void
  onClose: () => void
}

export function PlayerControls({
  isPlaying,
  isMinimized,
  isSlowMode,
  queue,
  onPlayPause,
  onToggleSlowMode,
  onPlayNext,
  onToggleMinimize,
  onClose,
}: PlayerControlsProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onPlayPause}
              className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              aria-label={isPlaying ? "Pause video" : "Play video"}
            >
              {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {isPlaying ? "Pause" : "Play"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onToggleSlowMode}
              className={`p-1 rounded hover:bg-accent transition-colors ${isSlowMode ? "text-red-300 bg-accent" : "text-red-600 text-muted-foreground hover:text-foreground"}`}
              aria-label={isSlowMode ? "Normal speed" : "Slow down debate spread"}
            >
              <Gauge className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {isSlowMode ? "Back to debate spread speed (1x)" : "Slow down debate spread 65%"}
          </TooltipContent>
        </Tooltip>

        {queue.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onPlayNext}
                className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                aria-label="Play next in queue"
              >
                <SkipForward className="h-3 w-3" />
                <span className="text-[10px] tabular-nums">{queue.length}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Skip to next ({queue.length} in queue)
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onToggleMinimize}
              className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              aria-label={isMinimized ? "Expand player" : "Minimize player"}
            >
              {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs max-w-48 text-center">
            {isMinimized ? "Expand player" : "Minimize player"}
            <br />
            <span className="text-muted-foreground">Drag to move · Resize from edges</span>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Close video"
            >
              <X className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Close player
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
