/**
 * @fileoverview Stance colors shared by the argument map's d3 views and its
 * Kialo-style focus view: pros green, cons red, the round's root claim blue.
 * Mid-lightness hues read on both the light and dark themes; deeper claims
 * get lighter so nested rings and circles stay distinguishable.
 */

import type { ArgumentStance } from "../../flow/argument-map"

const HUES: Record<ArgumentStance, { h: number; s: number }> = {
  root: { h: 210, s: 75 },
  pro: { h: 152, s: 62 },
  con: { h: 9, s: 78 },
}

/** Fill color for a claim at a given depth (deeper = lighter). */
export function stanceFill(stance: ArgumentStance, depth = 1): string {
  const { h, s } = HUES[stance]
  if (stance === "root") return `hsl(${h} ${s}% 68%)`
  const lightness = Math.min(36 + (depth - 1) * 9, 72)
  return `hsl(${h} ${s}% ${lightness}%)`
}

/** Solid outline/text color for a stance. */
export function stanceStroke(stance: ArgumentStance): string {
  const { h, s } = HUES[stance]
  return `hsl(${h} ${s}% ${stance === "root" ? 45 : 38}%)`
}

/** Tailwind text classes for the Pros / Cons column headings. */
export const STANCE_TEXT_CLASS: Record<"pro" | "con", string> = {
  pro: "text-emerald-700 dark:text-emerald-400",
  con: "text-red-700 dark:text-red-400",
}
