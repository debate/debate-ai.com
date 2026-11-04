/**
 * @fileoverview The one way a video's view total is shown.
 *
 * Every surface that prints a view count ("17k", "0.4k") renders it through
 * {@link ViewCount}, so a count reads at a glance. Totals fall into ten
 * tiers, each with its own color, size and weight: small totals are gray and
 * a touch smaller than the text around them, then the count climbs through
 * cool colors (sky, teal, green), into warm ones (lime, yellow, amber) and
 * reaches full gold at 30,000. Past gold it keeps going — orange, rose, then
 * violet for the most-watched rounds — and from gold up each tier also
 * carries its own lucide icon (star, flame, trophy, crown).
 *
 * The tier edges roughly double each step because view counts span four
 * orders of magnitude; a linear scale would leave almost every video looking
 * the same.
 *
 * @module view-count
 */

import type { CSSProperties, ReactNode } from "react";
import { Crown, Flame, Star, Trophy, type LucideIcon } from "lucide-react";
import { formatCount } from "./format-count";

/** One step on the view-count scale. */
export interface ViewCountTier {
  /** Short name, also exposed as `data-view-tier` for styling and tests. */
  name: string;
  /** Lowest total (inclusive) that lands in this tier. */
  min: number;
  /** Text color. Picked to stay readable on both light and dark backgrounds. */
  color: string;
  /** Font size relative to the surrounding text. */
  sizeEm: number;
  fontWeight: number;
  /** Shown before the number from gold up, in place of any caller icon. */
  icon?: LucideIcon;
}

/** Totals at or above this are gold, and start carrying an icon. */
export const VIEW_COUNT_GOLD = 30_000;

/** Every tier, lowest first. */
export const VIEW_COUNT_TIERS: readonly ViewCountTier[] = [
  { name: "gray", min: 0, color: "#8a8f98", sizeEm: 0.82, fontWeight: 500 },
  { name: "sky", min: 500, color: "#38bdf8", sizeEm: 0.87, fontWeight: 500 },
  { name: "teal", min: 1_000, color: "#14b8a6", sizeEm: 0.92, fontWeight: 500 },
  { name: "green", min: 2_500, color: "#22c55e", sizeEm: 0.96, fontWeight: 600 },
  { name: "lime", min: 5_000, color: "#84cc16", sizeEm: 1.0, fontWeight: 600 },
  { name: "yellow", min: 10_000, color: "#eab308", sizeEm: 1.05, fontWeight: 600 },
  { name: "amber", min: 20_000, color: "#f59e0b", sizeEm: 1.1, fontWeight: 700 },
  { name: "gold", min: VIEW_COUNT_GOLD, color: "#d4a017", sizeEm: 1.15, fontWeight: 700, icon: Star },
  { name: "orange", min: 60_000, color: "#f97316", sizeEm: 1.2, fontWeight: 700, icon: Flame },
  { name: "rose", min: 100_000, color: "#f43f5e", sizeEm: 1.25, fontWeight: 800, icon: Trophy },
  { name: "violet", min: 250_000, color: "#a855f7", sizeEm: 1.3, fontWeight: 800, icon: Crown },
];

/** The tier a total falls in. Invalid or negative totals are gray. */
export function viewCountTier(views: number): ViewCountTier {
  const n = Number.isFinite(views) ? views : 0;
  let tier = VIEW_COUNT_TIERS[0]!;
  for (const t of VIEW_COUNT_TIERS) if (n >= t.min) tier = t;
  return tier;
}

/** Inline color, size and weight for a view total. */
export function viewCountStyle(views: number): CSSProperties {
  const tier = viewCountTier(views);
  return { color: tier.color, fontSize: `${tier.sizeEm}em`, fontWeight: tier.fontWeight };
}

export interface ViewCountProps {
  /** The raw view total. */
  views: number;
  /** Text after the number, e.g. `" views"`. Styled with the number. */
  suffix?: string;
  /**
   * Rendered before the number (an eye icon, say) on tiers without their own
   * icon. Inherits the tier color.
   */
  icon?: ReactNode;
  className?: string;
}

/**
 * A view total, abbreviated with {@link formatCount} and colored, sized and
 * (from gold up) iconed by tier. The full number is in the tooltip.
 */
export function ViewCount({ views, suffix, icon, className }: ViewCountProps) {
  const safe = Number.isFinite(views) ? views : 0;
  const tier = viewCountTier(safe);
  const TierIcon = tier.icon;
  return (
    <span
      className={["inline-flex items-center gap-1 tabular-nums leading-none", className]
        .filter(Boolean)
        .join(" ")}
      style={viewCountStyle(safe)}
      title={`${safe.toLocaleString()} views`}
      data-view-tier={tier.name}
    >
      {TierIcon ? <TierIcon className="h-[1em] w-[1em] shrink-0" aria-hidden /> : icon}
      {formatCount(safe)}
      {suffix}
    </span>
  );
}
