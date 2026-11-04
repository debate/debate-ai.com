/**
 * @fileoverview Icon showing whether a card's source link still opens, from
 * the admin URL recheck saved on the card (see lib/source-url-status).
 */

"use client"

import { CircleCheck, CircleHelp, CircleX, TriangleAlert } from "lucide-react"
import { cn } from "../../ui/lib/utils"
import { describeSourceUrlStatus, type SourceUrlCheck } from "../../lib/source-url-status"

/** Icon and colour per status. */
const STATUS_ICON = {
  valid: { Icon: CircleCheck, className: "text-emerald-600 dark:text-emerald-400" },
  invalid: { Icon: CircleX, className: "text-red-600 dark:text-red-400" },
  error: { Icon: TriangleAlert, className: "text-amber-600 dark:text-amber-400" },
  unchecked: { Icon: CircleHelp, className: "text-muted-foreground" },
} as const

/** Props for {@link SourceUrlStatusIcon}. */
interface SourceUrlStatusIconProps {
  /** The result's saved check, if any. */
  check?: SourceUrlCheck | null
  /** Extra classes, e.g. a size. Defaults to `h-4 w-4`. */
  className?: string
  /** Also render the short label ("Link works", …) after the icon. */
  showLabel?: boolean
}

/**
 * A green check (opens), red cross (4xx/5xx), amber warning (timed out or
 * failed) or grey question mark (not checked yet), titled with the details.
 *
 * @param props - See {@link SourceUrlStatusIconProps}.
 * @returns The icon, labelled for screen readers.
 */
export function SourceUrlStatusIcon({ check, className, showLabel = false }: SourceUrlStatusIconProps) {
  const info = describeSourceUrlStatus(check)
  const { Icon, className: tone } = STATUS_ICON[info.status]
  return (
    <span
      className={cn("inline-flex items-center gap-1", tone)}
      title={info.description}
      data-testid="source-url-status"
      data-status={info.status}
    >
      <Icon className={className ?? "h-4 w-4"} aria-hidden="true" />
      {showLabel ? <span>{info.label}</span> : <span className="sr-only">{info.label}</span>}
    </span>
  )
}
