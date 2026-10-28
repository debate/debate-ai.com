/**
 * @fileoverview Parses the free-text "Arguments run" box on the Log-a-round
 * form into `argumentTags`, which `buildDebaterStats` groups into its
 * per-argument win/loss splits.
 */

/** Most tags kept per logged round, so one paste cannot bloat a synced record. */
export const MAX_ARGUMENT_TAGS = 10;

/** Longest single tag kept, in characters. */
export const MAX_ARGUMENT_TAG_LENGTH = 40;

/**
 * Splits comma/newline separated text into trimmed, lowercased, de-duplicated
 * tags (so "Kritik, kritik" counts once), capped at {@link MAX_ARGUMENT_TAGS}
 * and truncated to {@link MAX_ARGUMENT_TAG_LENGTH} characters each.
 */
export function parseArgumentTags(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(/[,\n]/)) {
    const tag = part.trim().toLowerCase().slice(0, MAX_ARGUMENT_TAG_LENGTH).trim();
    if (tag !== "") seen.add(tag);
    if (seen.size === MAX_ARGUMENT_TAGS) break;
  }
  return [...seen];
}
