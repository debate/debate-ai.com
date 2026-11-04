/**
 * @fileoverview The small uppercase pill that rides after a tournament's logo
 * or name: "RR" for a round-robin, or the tournament's own name when its logo
 * is a host school's (Wake Forest's logo, then "Shirley").
 */

import { cn } from "../../../ui/lib/utils"

export function TournamentNameBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded bg-muted px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  )
}
