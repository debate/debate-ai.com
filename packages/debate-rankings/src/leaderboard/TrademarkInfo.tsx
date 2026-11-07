/**
 * @fileoverview A small "i" icon pinned to the lower-left corner of a school
 * logo on team and school profile pages. Hovering (or tapping / focusing) it
 * shows the trademark disclaimer: the school's marks belong to the school,
 * are shown only to identify it, and imply no affiliation or endorsement.
 * The wording follows section 19 of `/legal/privacy` ("School Names, Logos,
 * and Trademarks"), which the tooltip links to.
 *
 * The icon is its own button, placed beside (not inside) any link that wraps
 * the logo, so hovering or clicking it never follows the logo's link.
 */

"use client"

import { useState, type ReactNode } from "react"
import { Info } from "lucide-react"
import { cn } from "./ui/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/primitives/tooltip"

/** Where the full clause lives: the `school-trademarks` section of the legal page. */
export const SCHOOL_TRADEMARKS_HREF = "/legal/privacy#school-trademarks"

/** The disclaimer's paragraphs, for the tooltip and for tests. */
export function schoolTrademarkDisclaimer(school: string, appName = "Debate AI"): string[] {
  return [
    `The name, logo, wordmark, and any other trademarks of ${school} are the property of ${school} or its respective owners. They are used here solely to identify and refer to the institution, and ${appName} claims no ownership of them.`,
    `${appName} is an independent service and is not affiliated with, sponsored by, endorsed by, or officially connected with ${school}. `,
  ]
}

/** The info icon and its disclaimer tooltip, for one school. */
export function TrademarkInfoIcon({ school, className }: { school: string; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Trademark notice for ${school}`}
          data-trademark-info=""
          onClick={(event) => {
            // Tap opens it on touch screens; never let it reach a wrapping link.
            event.preventDefault()
            event.stopPropagation()
            setOpen((value) => !value)
          }}
          className={cn(
            "inline-flex size-3.5 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm ring-1 ring-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <Info aria-hidden className="size-3" strokeWidth={2.25} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" sideOffset={4} className="max-w-xs text-left">
        <p className="mb-1 font-semibold">Trademark notice</p>
        {schoolTrademarkDisclaimer(school).map((text) => (
          <p key={text.slice(0, 24)} className="mb-1 font-normal leading-snug">
            {text}
          </p>
        ))}
        <a href={SCHOOL_TRADEMARKS_HREF} className="font-normal underline underline-offset-2">
          Read the full trademark terms
        </a>
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Wraps a logo (or a link holding one) and pins the info icon to its
 * lower-left corner. With no `school`, renders the children alone.
 */
export function WithTrademarkInfo({
  school,
  children,
  className,
}: {
  school?: string | null
  children: ReactNode
  className?: string
}) {
  if (!school) return <>{children}</>
  return (
    <span className={cn("relative inline-flex", className)}>
      {children}
      <TrademarkInfoIcon school={school} className="absolute -bottom-1 -left-1.5" />
    </span>
  )
}
