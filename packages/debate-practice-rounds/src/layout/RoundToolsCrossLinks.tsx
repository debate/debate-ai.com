/**
 * @fileoverview "Other round tools" cross-link row — closes
 * `docs/features/flow-tools-menu.md`'s Known gap that none of the four
 * flow-driven analysis pages (`/outline`, `/outcomes`, `/drills`,
 * `/coaching`) linked to each other, only back to the round workspace via
 * each page's own "Back" button. Rendered on each of those four pages
 * alongside that Back button, so a debater who followed the round
 * workspace's "Tools for this round" menu (`FlowToolsMenu.tsx`) to one tool
 * can jump straight to a sibling tool instead of returning to `/debate`
 * first.
 *
 * @module layout/RoundToolsCrossLinks
 */

import Link from "next/link"
import { buildCrossLinks } from "debate-round/src/round/flow-tool-links"

/** Props for the RoundToolsCrossLinks component. */
interface RoundToolsCrossLinksProps {
  /** The href of the page rendering this row (e.g. `"/outline"`), excluded from its own link list. */
  currentHref: string
}

/**
 * Small row of links to the other flow-driven analysis tools
 * ({@link import("../round/flow-tool-links").FLOW_TOOL_LINKS}), excluding
 * whichever one the caller is currently on.
 *
 * @param props.currentHref - See {@link RoundToolsCrossLinksProps.currentHref}.
 */
export function RoundToolsCrossLinks({ currentHref }: RoundToolsCrossLinksProps) {
  const links = buildCrossLinks(currentHref)
  if (links.length === 0) return null

  return (
    <nav aria-label="Other round tools" className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Other round tools:</span>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          title={link.description}
          className="inline-flex items-center h-7 px-2.5 rounded-md border border-border bg-background hover:bg-accent text-foreground transition-colors"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
