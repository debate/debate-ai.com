/**
 * @fileoverview The icon controls the video toolbars are built from.
 *
 * The floating popout player and the full-page watch player show the same
 * controls at different sizes, and they used to be two hand-written copies of
 * the same button markup. One of them always drifted — a different hover
 * colour, a missing `aria-label`, a tooltip on the wrong side. Both toolbars
 * now compose these, so a control never means or looks two different things.
 *
 * There are two of them because a control that navigates must be an anchor:
 * "watch on YouTube" has to survive a middle-click, and a `<button>` that
 * calls `window.open` does not.
 * @module components/video-player/PlayerIconButton
 */

"use client"

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/primitives/tooltip"
import { cn } from "../../ui/lib/utils"

/** Icon and hit-area sizes: `sm` for the popout player, `md` for the watch page. */
export type PlayerIconButtonSize = "sm" | "md"

const SIZES: Record<PlayerIconButtonSize, { control: string; icon: string }> = {
  sm: { control: "p-1", icon: "h-3 w-3" },
  md: { control: "p-1.5", icon: "h-4 w-4" },
}

/** Shared look of every control in both toolbars. */
function controlClass(size: PlayerIconButtonSize, active: boolean, hasBadge: boolean, extra?: string) {
  return cn(
    "rounded transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50",
    SIZES[size].control,
    hasBadge && "flex items-center gap-0.5",
    active ? "text-primary bg-accent" : "text-muted-foreground hover:text-foreground",
    extra,
  )
}

interface PlayerControlBaseProps {
  icon: LucideIcon
  /** Accessible name; also the fallback tooltip text. */
  label: string
  /** Tooltip body. Defaults to {@link PlayerControlBaseProps.label}. */
  tooltip?: ReactNode
  /** Renders the control in its "on" state (captions open, PiP active…). */
  active?: boolean
  size?: PlayerIconButtonSize
  tooltipSide?: "top" | "bottom" | "left" | "right"
  tooltipClassName?: string
  /** Rendered after the icon — the queue length beside "skip to next". */
  badge?: ReactNode
}

type PlayerIconButtonProps = PlayerControlBaseProps &
  Omit<ComponentPropsWithoutRef<"button">, "children" | "aria-label">

/**
 * A tooltipped icon button in the player toolbars.
 *
 * Must be rendered inside a `TooltipProvider`; both toolbars supply one.
 *
 * @param props - See {@link PlayerIconButtonProps}.
 */
export const PlayerIconButton = forwardRef<HTMLButtonElement, PlayerIconButtonProps>(
  function PlayerIconButton(
    {
      icon: Icon,
      label,
      tooltip,
      active = false,
      size = "sm",
      tooltipSide = "top",
      tooltipClassName,
      badge,
      className,
      ...buttonProps
    },
    ref,
  ) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={ref}
            aria-label={label}
            aria-pressed={active || undefined}
            className={controlClass(size, active, badge != null, className)}
            {...buttonProps}
          >
            <Icon className={SIZES[size].icon} />
            {badge}
          </button>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide} className={cn("text-xs", tooltipClassName)}>
          {tooltip ?? label}
        </TooltipContent>
      </Tooltip>
    )
  },
)

type PlayerIconLinkProps = PlayerControlBaseProps &
  Omit<ComponentPropsWithoutRef<"a">, "children" | "aria-label">

/**
 * The same control as {@link PlayerIconButton}, rendered as a link.
 *
 * @param props - See {@link PlayerIconLinkProps}; `href` is required.
 */
export const PlayerIconLink = forwardRef<HTMLAnchorElement, PlayerIconLinkProps>(
  function PlayerIconLink(
    {
      icon: Icon,
      label,
      tooltip,
      active = false,
      size = "sm",
      tooltipSide = "top",
      tooltipClassName,
      badge,
      className,
      ...anchorProps
    },
    ref,
  ) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            ref={ref}
            aria-label={label}
            className={controlClass(size, active, badge != null, cn("inline-flex items-center", className))}
            {...anchorProps}
          >
            <Icon className={SIZES[size].icon} />
            {badge}
          </a>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide} className={cn("text-xs", tooltipClassName)}>
          {tooltip ?? label}
        </TooltipContent>
      </Tooltip>
    )
  },
)
