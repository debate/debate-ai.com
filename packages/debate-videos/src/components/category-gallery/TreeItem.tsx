/**
 * @fileoverview Shared tree-node renderer for the videos sidebar's nav tree
 * (`VideoSidebarTree`) and the tool-only nav tree (`ToolNavTree`) that mirrors
 * it on non-video pages. Extracted from `VideoSidebarTree` so both trees stay
 * visually identical without duplicating the row/expand-button markup.
 *
 * Two things a caller controls separately:
 *
 * - `level` picks the heading element and its typography — 1 renders an `h1`
 *   for a top-level section (Videos / Apps / Coaching / Research / Practice),
 *   2 an `h2` for a subgroup inside one, 3 a plain `span` for leaf links,
 *   which are navigation rather than document structure.
 * - Indentation comes from *nesting*, not from `level`: each expanded node
 *   pads its child list, so a leaf sits one step in from its parent wherever
 *   in the tree it happens to hang.
 *
 * Omitting `href` makes the row heading-only: a plain click does nothing but
 * toggle the node, which is what the h1 sections are for — they are groupings
 * rather than destinations. Such a row still renders as an anchor when it is
 * given a `sectionHref`, so a ctrl/cmd/shift/middle-click opens that section's
 * flagship page in a new tab; only the plain click is intercepted.
 *
 * @module components/category-gallery/TreeItem
 */

"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "../../ui/lib/utils";
import { isComponentIcon, isImageIcon, type TreeItemIcon } from "./tree-item-icon";

/**
 * The one icon treatment every row in the tree draws with: a fixed 16px box
 * that never shrinks, and `text-muted-foreground` — which a Lucide glyph
 * picks up through `currentColor`, so the section headings and all of their
 * tool rows render the same color.
 *
 * An imported image (the `imageSrc` branch below) cannot take a text color:
 * it draws at whatever colors are baked into the file. That is why every row
 * in the tool tree carries a Lucide component — `SidebarToolLink.icon` is
 * typed `LucideIcon` rather than `TreeItemIcon` for exactly this reason — and
 * why this class is exported: `tool-nav-tree-icons.test.tsx` asserts the tool
 * tree renders no image icons alongside them.
 */
export const TREE_ITEM_ICON_CLASS = "h-4 w-4 shrink-0 text-muted-foreground";

/**
 * Whether a click asks for the link to be opened somewhere other than this
 * tab — ctrl/cmd (new tab), shift (new window), alt (download), or any button
 * but the primary one (middle-click is a new tab too).
 *
 * A row that handles such a click itself steals it from the browser, which is
 * why the section headings — plain `<button>`s with nothing to open — could
 * not be ctrl-clicked at all. Rows that carry a destination hand these
 * straight back.
 */
export function opensElsewhere(
  event: React.MouseEvent<HTMLElement>,
): boolean {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  );
}

export interface TreeItemProps {
  /** Heading level: 1 = top-level section, 2 = subgroup, 3 = leaf link. */
  level: 1 | 2 | 3;
  /** Destination. Omit to make the row a heading that only toggles the node. */
  href?: string;
  /**
   * Where a heading row points when it is opened deliberately — ctrl/cmd,
   * shift or middle-click. A plain click still only toggles the node, which
   * is what the headings are for; this exists so "open in a new tab" works on
   * every row in the tree rather than silently doing nothing on the five that
   * happen to be groupings. Ignored when `href` is set.
   */
  sectionHref?: string;
  title: string;
  count?: number;
  isActive?: boolean;
  /** An imported image (SVG/PNG) or a Lucide component. */
  icon?: TreeItemIcon;
  /** Present together with `onToggleExpand` to make this item expandable. */
  expanded?: boolean;
  onToggleExpand?: () => void;
  /** De-emphasizes leaf items (used for the Glossary/Rankings links). */
  muted?: boolean;
  children?: React.ReactNode;
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

export function TreeItem({
  level,
  href,
  sectionHref,
  title,
  count,
  isActive,
  icon,
  expanded,
  onToggleExpand,
  muted,
  children,
}: TreeItemProps) {
  const pathname = usePathname();
  const expandable = children != null && onToggleExpand != null;

  // Clicking a nav row used to look like nothing had happened: the router
  // fetches the destination before it renders any of it, and on `/videos`
  // that fetch competes with a grid of several hundred cards, so the row
  // stayed inert for long enough to read as a dead click and get clicked
  // again. This marks the row the moment it is pressed — no waiting on the
  // network — and clears when the route it asked for arrives.
  const [pending, setPending] = React.useState(false);
  React.useEffect(() => {
    setPending(false);
  }, [pathname]);
  React.useEffect(() => {
    if (!pending) return;
    // A row can point at the route already showing (the category links toggle
    // back to `/videos`), where no pathname change ever arrives to clear the
    // mark. Nothing here should be able to leave a row permanently dimmed.
    const timer = setTimeout(() => setPending(false), 4000);
    return () => clearTimeout(timer);
  }, [pending]);
  const Heading = level === 1 ? "h1" : level === 2 ? "h2" : "span";
  // The icon set in `ui/icons` arrives as image sources for `next/image`;
  // Lucide icons as components. `isImageIcon` is the discriminator — a
  // `typeof icon === "function"` test does not work, because Lucide builds
  // every icon with `forwardRef` and those are objects. See
  // `./tree-item-icon`.
  const imageSrc = isImageIcon(icon) ? icon : null;
  const Glyph = isComponentIcon(icon) ? icon : null;

  const rowClassName = cn(
    "flex min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 pl-2 pr-2 text-left transition-colors hover:bg-muted/60",
  );

  const rowContents = (
    <>
      {Glyph ? (
        <Glyph className={TREE_ITEM_ICON_CLASS} aria-hidden />
      ) : imageSrc ? (
        <Image src={imageSrc} alt="" width={16} height={16} className="h-4 w-4 shrink-0 object-contain" unoptimized />
      ) : null}
      <Heading
        className={cn(
          "min-w-0 flex-1 truncate",
          level === 1 && "text-sm font-semibold text-foreground",
          level === 2 && "text-sm font-medium text-foreground",
          level === 3 && (muted ? "text-xs text-muted-foreground" : "text-sm text-foreground"),
          isActive && "text-primary",
        )}
      >
        {title}
      </Heading>
      {count != null && count > 0 && (
        <span className="shrink-0 text-xs font-medium text-muted-foreground">{formatCount(count)}</span>
      )}
    </>
  );

  const chevron = (
    <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 transition-transform", expanded && "rotate-90")} />
  );

  return (
    <div>
      <div
        className={cn(
          "flex items-stretch gap-0.5 rounded-md",
          isActive && "bg-primary/5 ring-1 ring-primary/40",
        )}
      >
        {href == null ? (
          // Heading-only row: the whole thing is the toggle, so the chevron
          // rides inside the same button rather than sitting beside a link.
          //
          // Still an anchor when the section has a flagship destination, so
          // ctrl/cmd/shift/middle-click opens it the way it does on every
          // other row in the tree. A plain click is intercepted and only
          // toggles the section — headings are groupings, not destinations.
          sectionHref ? (
            <a
              href={sectionHref}
              onClick={(event) => {
                if (opensElsewhere(event)) return;
                event.preventDefault();
                onToggleExpand?.();
              }}
              onAuxClick={(event) => {
                // Middle-click reaches `onAuxClick`, never `onClick`; letting
                // it through is all that is needed for the new tab.
                if (event.button === 1) event.stopPropagation();
              }}
              aria-expanded={expandable ? expanded : undefined}
              className={cn(rowClassName, "text-muted-foreground")}
            >
              {rowContents}
              {expandable && chevron}
            </a>
          ) : (
            <button
              type="button"
              onClick={onToggleExpand}
              aria-expanded={expandable ? expanded : undefined}
              className={cn(rowClassName, "text-muted-foreground")}
            >
              {rowContents}
              {expandable && chevron}
            </button>
          )
        ) : (
          <>
            {/* `prefetch={false}`: the tree renders dozens of links at once,
                and the router fetched an RSC payload for every one of them
                the moment the sidebar mounted — a burst of requests
                competing with the video feed and its thumbnails on exactly
                the page that felt slowest. Navigation still fetches on
                click. */}
            <Link
              href={href}
              prefetch={false}
              // Only a plain click navigates this tab; a ctrl/cmd/shift click
              // is opening a second one and must not make this row look like
              // it is going anywhere.
              onClick={(event) => {
                if (opensElsewhere(event)) return;
                setPending(true);
              }}
              aria-busy={pending || undefined}
              className={cn(rowClassName, pending && "opacity-60")}
            >
              {rowContents}
            </Link>
            {expandable && (
              <button
                type="button"
                onClick={onToggleExpand}
                aria-expanded={expanded}
                aria-label={`${expanded ? "Collapse" : "Expand"} ${title}`}
                className="flex w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                {chevron}
              </button>
            )}
          </>
        )}
      </div>
      {expandable && expanded && (
        // Indentation is nesting-based: one step per level of the tree, so a
        // leaf under a subgroup sits deeper than one hanging off a section.
        <ul className="mt-0.5 flex flex-col gap-0.5 pl-5">
          {React.Children.map(children, (child) => (
            <li className="list-none">{child}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
