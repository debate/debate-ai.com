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
 * Omitting `href` makes the row heading-only: it renders as a button that
 * does nothing but toggle the node, used for the h1 sections, which are
 * groupings rather than destinations of their own.
 *
 * @module components/category-gallery/TreeItem
 */

"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { cn } from "../../ui/lib/utils";
import { isComponentIcon, isImageIcon, type TreeItemIcon } from "./tree-item-icon";

export interface TreeItemProps {
  /** Heading level: 1 = top-level section, 2 = subgroup, 3 = leaf link. */
  level: 1 | 2 | 3;
  /** Destination. Omit to make the row a heading that only toggles the node. */
  href?: string;
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
  title,
  count,
  isActive,
  icon,
  expanded,
  onToggleExpand,
  muted,
  children,
}: TreeItemProps) {
  const expandable = children != null && onToggleExpand != null;
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
        <Glyph className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
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
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={expandable ? expanded : undefined}
            className={cn(rowClassName, "text-muted-foreground")}
          >
            {rowContents}
            {expandable && chevron}
          </button>
        ) : (
          <>
            <Link href={href} className={rowClassName}>
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
