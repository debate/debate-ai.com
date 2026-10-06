/**
 * @fileoverview Lettered badge icons for the debate-format rows of the videos
 * sidebar: NDT (College Debates), VP (Policy), PF and LD.
 *
 * Each is a rounded outline with the format's abbreviation inside, drawn on a
 * 280×168 canvas. They are typed as `LucideIcon` so they drop into
 * `SidebarVideoLink.glyph` beside the Lucide glyphs, and every surface that
 * draws a glyph — the sidebar tree, the dock's nav menu — renders them with
 * no special case.
 *
 * The canvas is 5:3, not square, so the caller's sizing keeps its height and
 * the width is forced to `auto`: squeezed into the rows' 16×16 box the
 * letters would shrink to an unreadable ~6px.
 *
 * @module components/category-gallery/format-badge-icons
 */

import React, { forwardRef } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import { cn } from "../../ui/lib/utils";

const BADGE_COLOR = "#91A5C4";

function createFormatBadgeIcon(label: string, displayName: string): LucideIcon {
  const Badge = forwardRef<SVGSVGElement, LucideProps>(function FormatBadge(
    // Lucide-only props have no meaning for a lettered badge; drop them so
    // they never reach the DOM.
    { className, size: _size, absoluteStrokeWidth: _absoluteStrokeWidth, color: _color, strokeWidth: _strokeWidth, ...props },
    ref,
  ) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width="280"
        height="168"
        viewBox="0 0 280 168"
        className={cn(className, "w-auto")}
        {...props}
      >
        <rect width="280" height="168" fill="none" />
        <rect x="5" y="5" width="270" height="158" rx="42" fill="none" stroke={BADGE_COLOR} strokeWidth="10" />
        <text
          x="140"
          y="84"
          fill={BADGE_COLOR}
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="72"
          fontWeight="700"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {label}
        </text>
      </svg>
    );
  });
  Badge.displayName = displayName;
  return Badge as LucideIcon;
}

/** College Debates — the NDT circuit. */
export const IconFormatNDT = createFormatBadgeIcon("NDT", "IconFormatNDT");
/** Policy Debates — varsity policy. */
export const IconFormatVP = createFormatBadgeIcon("VP", "IconFormatVP");
/** Public Forum. */
export const IconFormatPF = createFormatBadgeIcon("PF", "IconFormatPF");
/** Lincoln-Douglas. */
export const IconFormatLD = createFormatBadgeIcon("LD", "IconFormatLD");
