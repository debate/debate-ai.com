"use client"

/**
 * @fileoverview A `next/link` that also records the click in the
 * "Recent" tools store (`lib/hooks/useRecentTools.ts`) — the same store the
 * command palette's own "Recent" group already reads and writes.
 *
 * Before this, only a palette selection promoted a tool to "Recent" (see
 * `command-palette.mdx`'s Known gaps: "a tool opened via its own `/tools`
 * card, a direct link, or the editor's Workspace menu doesn't promote it
 * here"). `app/tools/page.tsx` now uses this in place of a plain `Link` for
 * its grid cards and favorites chips, so opening a tool from `/tools`
 * itself counts too, and `RecentlyOpenedTools.tsx` can show something
 * beyond what the palette alone produced.
 *
 * @module components/tools/RecordVisitLink
 */

import Link from "next/link"
import type { ComponentProps } from "react"
import { useRecentTools } from "@/lib/hooks/useRecentTools"

type Props = ComponentProps<typeof Link>

export function RecordVisitLink({ href, onClick, ...rest }: Props) {
  const { recordVisit } = useRecentTools()

  return (
    <Link
      href={href}
      onClick={(event) => {
        onClick?.(event)
        if (typeof href === "string") recordVisit(href)
      }}
      {...rest}
    />
  )
}
