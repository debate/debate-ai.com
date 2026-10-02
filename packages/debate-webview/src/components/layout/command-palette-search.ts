/**
 * @fileoverview Ranking and match-highlighting for the app-wide Ctrl/Cmd-K
 * palette ({@link ./GlobalCommandPalette}).
 *
 * cmdk's built-in filter scores every item on one flat `value` string, so a
 * word that only appears in a long description could outrank a tool whose
 * label starts with what was typed, and there was no way to show *why* an
 * item matched. This swaps it for fuse.js over weighted fields (label first,
 * then highlights, description, group and path), then re-ranks with label
 * bonuses so exact and prefix label hits always lead. Kept free of React so
 * the ranking is unit-tested on its own.
 *
 * @module components/layout/command-palette-search
 */

import Fuse, { type FuseResultMatch, type IFuseOptions } from "fuse.js"

/** One searchable palette destination. `group` is the catalog heading it
 *  sits under (or "Go to" for the palette's own quick actions). */
export interface PaletteEntry<T = unknown> {
  href: string
  label: string
  description: string
  highlights?: string[]
  group: string
  /** The caller's own record, passed back untouched on each result. */
  data: T
}

/** A half-open `[start, end)` character range to highlight. */
export type MatchRange = [number, number]

export interface PaletteResult<T = unknown> {
  entry: PaletteEntry<T>
  /** Lower is better, `0` a perfect hit — fuse's score less label bonuses. */
  score: number
  labelRanges: MatchRange[]
  descriptionRanges: MatchRange[]
}

const FUSE_OPTIONS: IFuseOptions<PaletteEntry> = {
  includeScore: true,
  includeMatches: true,
  ignoreLocation: true,
  // Slightly looser than fuse's 0.6 default would let "rsrch" find
  // "Research" but stops one shared letter from matching everything.
  threshold: 0.38,
  minMatchCharLength: 2,
  keys: [
    { name: "label", weight: 4 },
    { name: "highlights", weight: 1.5 },
    { name: "description", weight: 1 },
    { name: "group", weight: 0.6 },
    { name: "href", weight: 0.6 },
  ],
}

/** Builds the fuse index once per catalog; reuse it across keystrokes. */
export function createPaletteIndex<T>(entries: PaletteEntry<T>[]): Fuse<PaletteEntry<T>> {
  return new Fuse(entries, FUSE_OPTIONS as IFuseOptions<PaletteEntry<T>>)
}

function tokens(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean)
}

/** Label bonuses fuse doesn't model: exact, prefix, and word-start hits. */
function labelBonus(label: string, query: string): number {
  const l = label.toLowerCase()
  const q = query.toLowerCase().trim()
  if (l === q) return 1
  if (l.startsWith(q)) return 0.6
  const words = l.split(/[\s\-/()&]+/)
  const qs = tokens(q)
  if (qs.length > 0 && qs.every((t) => words.some((w) => w.startsWith(t)))) return 0.45
  if (l.includes(q)) return 0.3
  // Acronyms: "ai" → "AI Judge", "pr" → "Prep Room".
  const initials = words.map((w) => w[0] ?? "").join("")
  if (q.length >= 2 && initials.startsWith(q.replace(/\s+/g, ""))) return 0.35
  return 0
}

/** Merges overlapping/adjacent ranges and sorts them. */
export function mergeRanges(ranges: MatchRange[]): MatchRange[] {
  const sorted = [...ranges].filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0])
  const out: MatchRange[] = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else out.push([r[0], r[1]])
  }
  return out
}

function isWordStart(text: string, at: number): boolean {
  return at === 0 || !/[a-z0-9]/i.test(text[at - 1])
}

/**
 * Ranges of `text` to highlight for `query`. Whole-token substring hits
 * read best, so those win — at word starts when a token has any ("ai"
 * lights up "AI", not the middle of "against"). Only when no token is a
 * substring at all do the fuzzy indices fuse reported fill in, with
 * one-letter gaps bridged so "reserch" marks "Research" as one run rather
 * than "Rese·a·rch".
 */
export function highlightRanges(text: string, query: string, fuseMatch?: FuseResultMatch): MatchRange[] {
  const lower = text.toLowerCase()
  const ranges: MatchRange[] = []
  for (const t of tokens(query)) {
    const hits: number[] = []
    for (let at = lower.indexOf(t); at >= 0; at = lower.indexOf(t, at + t.length)) hits.push(at)
    const starts = hits.filter((at) => isWordStart(text, at))
    for (const at of starts.length > 0 ? starts : hits) ranges.push([at, at + t.length])
  }
  if (ranges.length === 0 && fuseMatch) {
    const fuzzy = mergeRanges(fuseMatch.indices.map(([s, e]) => [s, e + 1] as MatchRange))
    for (let i = fuzzy.length - 1; i > 0; i--) {
      if (fuzzy[i][0] - fuzzy[i - 1][1] <= 1) {
        fuzzy[i - 1][1] = fuzzy[i][1]
        fuzzy.splice(i, 1)
      }
    }
    return fuzzy
  }
  return mergeRanges(ranges)
}

/** Ranked results for `query`, best first. An empty query returns `[]` —
 *  the palette shows its browse view (favorites, recent, catalog) instead. */
export function searchPalette<T>(index: Fuse<PaletteEntry<T>>, query: string, limit = 50): PaletteResult<T>[] {
  const q = query.trim()
  if (!q) return []
  return index
    .search(q)
    .map((r) => {
      const labelMatch = r.matches?.find((m) => m.key === "label")
      const descMatch = r.matches?.find((m) => m.key === "description")
      return {
        entry: r.item,
        score: (r.score ?? 1) - labelBonus(r.item.label, q),
        labelRanges: highlightRanges(r.item.label, q, labelMatch),
        descriptionRanges: highlightRanges(r.item.description, q, descMatch),
      }
    })
    .sort((a, b) => a.score - b.score || a.entry.label.localeCompare(b.entry.label))
    .slice(0, limit)
}

/** Splits `text` into plain/highlighted segments for rendering. */
export function splitByRanges(text: string, ranges: MatchRange[]): { text: string; match: boolean }[] {
  const out: { text: string; match: boolean }[] = []
  let at = 0
  for (const [s, e] of ranges) {
    if (s > at) out.push({ text: text.slice(at, s), match: false })
    out.push({ text: text.slice(s, e), match: true })
    at = e
  }
  if (at < text.length) out.push({ text: text.slice(at), match: false })
  return out
}
