/**
 * @fileoverview Module-level cache for `evidence-search-index.ts`'s built
 * `EvidenceSearchIndex`, closing the "caching the index across calls instead
 * of rebuilding it on every search" follow-up named under the "📋 Shared
 * Evidence Library" bullet in TODO.md ("this store still has no write-time
 * hook to invalidate a cache").
 *
 * Split into its own module, separate from both `evidenceLibraryEntries.ts`
 * (which builds and reads the cached index) and `peerReviews.ts` (whose
 * review-lifecycle writes change an entry's "live" gating, and therefore
 * whether it belongs in the index), so each store can invalidate the shared
 * cache on its own writes without a circular import between them.
 *
 * @module state/evidenceSearchIndexCache
 */

import type { EvidenceSearchIndex } from "../lib/evidence-search-index";

let cachedIndex: EvidenceSearchIndex | null = null;

/** Returns the cached index, or `null` if nothing is cached (never built yet, or invalidated since). */
export function getCachedEvidenceSearchIndex(): EvidenceSearchIndex | null {
  return cachedIndex;
}

/** Stores `index` as the cached index, replacing whatever was cached before. */
export function setCachedEvidenceSearchIndex(index: EvidenceSearchIndex): void {
  cachedIndex = index;
}

/**
 * Invalidates the cached index; the next read rebuilds it from scratch. Call
 * this from any write that can change which entries the index should cover.
 */
export function invalidateEvidenceSearchIndexCache(): void {
  cachedIndex = null;
}
