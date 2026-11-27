"use client"
/**
 * @file reference-icon-button.tsx
 * @description The small icon button used in the row at the top of each card
 * in the References side panel (`reference-card-actions.tsx`): a Lucide icon in
 * a 28px square, with its name as the accessible label and as a tooltip, so a
 * row of three sits above a card without growing it.
 */
import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { cn } from "../../lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"

interface ReferenceIconButtonProps extends Omit<ComponentPropsWithoutRef<"button">, "title" | "aria-label"> {
  /** The accessible name, which is also the tooltip. */
  label: string
  /** Tooltip text when it should say more than `label`. */
  tooltip?: string
  /** The icon (a Lucide element sized by the button). */
  children: ReactNode
}

export function ReferenceIconButton({ label, tooltip, className, children, type = "button", ...props }: ReferenceIconButtonProps) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type={type}
          aria-label={label}
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-fd-muted-foreground transition-colors",
            "hover:bg-fd-accent hover:text-fd-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring",
            "disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4",
            className,
          )}
          {...props}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="z-[75] max-w-64 text-center">
        {tooltip ?? label}
      </TooltipContent>
    </Tooltip>
  )
}
