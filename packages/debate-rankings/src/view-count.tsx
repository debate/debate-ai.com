/**
 * @fileoverview The one way a video's view total is shown.
 *
 * Every surface that prints a view count ("17k", "0.4k") renders it through
 * {@link ViewCount}, so a count reads at a glance: small totals are gray and a
 * touch smaller than the text around them, and the bigger the number, the
 * larger and more golden it gets. 30,000 views is full gold; past that the
 * color keeps warming toward bright yellow and the text keeps growing a little.
 *
 * The scale is logarithmic (100 → 30,000 → 300,000) because view counts span
 * four orders of magnitude, and a linear ramp would leave almost every video
 * looking the same gray.
 *
 * @module view-count
 */

import type { CSSProperties, ReactNode } from "react";
import { formatCount } from "./format-count";

/** Totals at or below this read as plain gray at the smallest size. */
export const VIEW_COUNT_FLOOR = 100;
/** Totals at or above this are full gold. */
export const VIEW_COUNT_GOLD = 30_000;
/** Past gold the color keeps getting yellower until this total. */
export const VIEW_COUNT_CEILING = 300_000;

const LOG_FLOOR = Math.log10(VIEW_COUNT_FLOOR);
const LOG_GOLD = Math.log10(VIEW_COUNT_GOLD);
const LOG_CEILING = Math.log10(VIEW_COUNT_CEILING);

/**
 * RGB stops: gray, gold (30k), bright yellow (300k+). Blended in RGB rather
 * than by hue so the ramp goes gray → khaki → gold without passing through
 * blue or green.
 */
const GRAY = [138, 143, 152] as const;
const GOLD = [212, 160, 23] as const;
const YELLOW = [250, 204, 21] as const;

/** Font size (in `em`, relative to the surrounding text) at each stop. */
const SIZE_GRAY = 0.85;
const SIZE_GOLD = 1.15;
const SIZE_YELLOW = 1.3;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/**
 * Where a total sits on the scale: 0 at {@link VIEW_COUNT_FLOOR} or less,
 * 1 at {@link VIEW_COUNT_GOLD}, 2 at {@link VIEW_COUNT_CEILING} or more.
 */
export function viewCountLevel(views: number): number {
  if (!Number.isFinite(views) || views <= VIEW_COUNT_FLOOR) return 0;
  const log = Math.log10(views);
  if (log < LOG_GOLD) return (log - LOG_FLOOR) / (LOG_GOLD - LOG_FLOOR);
  return 1 + clamp01((log - LOG_GOLD) / (LOG_CEILING - LOG_GOLD));
}

/** Inline color, size and weight for a view total. */
export function viewCountStyle(views: number): CSSProperties {
  const level = viewCountLevel(views);
  const [from, to, t, sizeFrom, sizeTo] =
    level <= 1
      ? [GRAY, GOLD, level, SIZE_GRAY, SIZE_GOLD]
      : [GOLD, YELLOW, level - 1, SIZE_GOLD, SIZE_YELLOW];
  const [r, g, b] = from.map((c, i) => Math.round(lerp(c, to[i]!, t)));
  return {
    color: `rgb(${r}, ${g}, ${b})`,
    fontSize: `${lerp(sizeFrom, sizeTo, t).toFixed(3)}em`,
    fontWeight: level >= 1 ? 700 : level >= 0.5 ? 600 : 500,
  };
}

export interface ViewCountProps {
  /** The raw view total. */
  views: number;
  /** Text after the number, e.g. `" views"`. Styled with the number. */
  suffix?: string;
  /** Rendered before the number (an eye icon, say). Inherits the color. */
  icon?: ReactNode;
  className?: string;
}

/**
 * A view total, abbreviated with {@link formatCount} and colored/sized by
 * magnitude. The full number is in the tooltip.
 */
export function ViewCount({ views, suffix, icon, className }: ViewCountProps) {
  const safe = Number.isFinite(views) ? views : 0;
  return (
    <span
      className={["inline-flex items-center gap-1 tabular-nums leading-none", className]
        .filter(Boolean)
        .join(" ")}
      style={viewCountStyle(safe)}
      title={`${safe.toLocaleString()} views`}
      data-view-level={viewCountLevel(safe).toFixed(2)}
    >
      {icon}
      {formatCount(safe)}
      {suffix}
    </span>
  );
}
