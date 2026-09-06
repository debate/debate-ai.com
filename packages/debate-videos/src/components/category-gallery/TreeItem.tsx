/**
 * @fileoverview Shared tree-node renderer for the videos sidebar's nav tree
 * (`VideoSidebarTree`) and the tool-only nav tree (`ToolNavTree`) that mirrors
 * it on non-video pages. Extracted from `VideoSidebarTree` so both trees stay
 * visually identical without duplicating the row/expand-button markup.
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
  /** Heading level: 2 = top-level section, 3 = subgroup, category, or leaf child. */
  level: 2 | 3;
  href: string;
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
  const Heading = level === 2 ? "h2" : "span";
  // The icon set in `ui/icons` arrives as image sources for `next/image`;
  // Lucide icons as components. `isImageIcon` is the discriminator — a
  // `typeof icon === "function"` test does not work, because Lucide builds
  // every icon with `forwardRef` and those are objects. See
  // `./tree-item-icon`.
  const imageSrc = isImageIcon(icon) ? icon : null;
  const Glyph = isComponentIcon(icon) ? icon : null;

  return (
    <div>
      <div
        className={cn(
          "flex items-stretch gap-0.5 rounded-md",
          isActive && "bg-primary/5 ring-1 ring-primary/40",
        )}
      >
        <Link
          href={href}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 pr-2 transition-colors hover:bg-muted/60",
            level === 3 ? "pl-7" : "pl-2",
          )}
        >
          {Glyph ? (
            <Glyph className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          ) : imageSrc ? (
            <Image src={imageSrc} alt="" width={16} height={16} className="h-4 w-4 shrink-0 object-contain" unoptimized />
          ) : null}
          <Heading
            className={cn(
              "min-w-0 flex-1 truncate",
              level === 2 && "font-medium text-foreground",
              level === 3 && (muted ? "text-xs text-muted-foreground" : "text-sm text-foreground"),
              isActive && "text-primary",
            )}
          >
            {title}
          </Heading>
          {count != null && count > 0 && (
            <span className="shrink-0 text-xs font-medium text-muted-foreground">{formatCount(count)}</span>
          )}
        </Link>
        {expandable && (
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${title}`}
            className="flex w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")} />
          </button>
        )}
      </div>
      {expandable && expanded && (
        <ul className="mt-0.5 flex flex-col gap-0.5">
          {React.Children.map(children, (child) => (
            <li className="list-none">{child}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
