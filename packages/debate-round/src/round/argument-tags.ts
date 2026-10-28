/**
 * @fileoverview Parses the comma-separated "argument tags" form field into a
 * logged round's `argumentTags` array (feeds the per-argument split in
 * `debater-stats.ts`). Shared by the opponent-profile and own-round log forms.
 *
 * @module round/argument-tags
 */

/** Splits a comma-separated tags field, trimming blanks and dropping case-insensitive duplicates. */
export function parseArgumentTags(raw: string): string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const piece of raw.split(",")) {
    const tag = piece.trim()
    const key = tag.toLowerCase()
    if (!tag || seen.has(key)) continue
    seen.add(key)
    tags.push(tag)
  }
  return tags
}
