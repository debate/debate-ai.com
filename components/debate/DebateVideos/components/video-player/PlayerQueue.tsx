import { ListVideo } from "lucide-react"
import type { QueueItem } from "@/lib/state/videoPlayerStore"

interface PlayerQueueProps {
  queue: QueueItem[]
}

export function PlayerQueue({ queue }: PlayerQueueProps) {
  if (queue.length === 0) return null

  return (
    <div className="border-t border-border/50 bg-muted/40 px-3 py-2">
      <div className="flex items-center gap-1 mb-1">
        <ListVideo className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Up next</span>
      </div>
      <p className="text-xs text-foreground truncate">{queue[0].title}</p>
      {queue.length > 1 && (
        <p className="text-[10px] text-muted-foreground">+{queue.length - 1} more in queue</p>
      )}
    </div>
  )
}
