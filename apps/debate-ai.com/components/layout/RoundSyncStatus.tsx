"use client"

/**
 * Small fixed-position badge reporting whether the open FIAT round is being
 * mirrored to the user's account (see lib/hooks/useRoundsCloudSync.ts).
 * Mounted once per /debate page, not per round — the hook itself tracks
 * whichever round changed.
 */

import { Cloud, CloudOff, Loader2 } from "lucide-react"
import { cn } from "debate-ui/src/lib/utils"
import { useRoundsCloudSync } from "@/lib/hooks/useRoundsCloudSync"

const COPY: Record<string, { label: string; icon: typeof Cloud; className: string }> = {
  idle: { label: "Synced to your account", icon: Cloud, className: "text-muted-foreground" },
  saving: { label: "Saving…", icon: Loader2, className: "text-muted-foreground" },
  saved: { label: "Saved to your account", icon: Cloud, className: "text-primary" },
  error: { label: "Couldn't save — retrying", icon: CloudOff, className: "text-destructive" },
  "signed-out": { label: "Signed out — saving on this device only", icon: CloudOff, className: "text-muted-foreground" },
}

export function RoundSyncStatus() {
  const { status } = useRoundsCloudSync()
  const { label, icon: Icon, className } = COPY[status]

  return (
    <div
      className={cn(
        "fixed bottom-20 md:bottom-3 right-3 z-40 flex items-center gap-1.5 rounded-full border bg-background/90 px-2.5 py-1 text-xs shadow-sm backdrop-blur",
        className,
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", status === "saving" && "animate-spin")} />
      <span>{label}</span>
    </div>
  )
}
