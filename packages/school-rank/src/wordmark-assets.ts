/**
 * @fileoverview The wordmark pngs themselves. Kept out of the main entry so
 * data and search code never import images: use
 * `@debate-ai/school-rank/wordmarks` where a bundler can load pngs.
 * Paths match {@link WORDMARK_ROWS} under `wordmarks/colleges` and
 * `wordmarks/high-schools`.
 * @module wordmark-assets
 */

import * as icons from "./wordmarks/icons"
import type { RankedSchool } from "./types"

const exportName = (file: string): string =>
  "IconSchool" +
  file
    .replace(/^.*\//, "")
    .replace(/\.png$/, "")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")

/**
 * The URL of a school's wordmark (or of a wordmark file path such as
 * `"colleges/yale.png"`), or `null` when it has none.
 */
export function wordmarkSrc(schoolOrFile: Pick<RankedSchool, "wordmark"> | string | null | undefined): string | null {
  const file = typeof schoolOrFile === "string" ? schoolOrFile : schoolOrFile?.wordmark
  if (!file) return null
  const image = (icons as Record<string, unknown>)[exportName(file)] as string | { src: string } | undefined
  if (!image) return null
  return typeof image === "string" ? image : image.src
}

export * from "./wordmarks/icons"
