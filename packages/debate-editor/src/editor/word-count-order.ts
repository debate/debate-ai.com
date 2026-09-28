/**
 * Left-to-right order of the live word-count readouts on the bottom
 * bar. Two settings hold one order each: `wordCountOrder` while editing
 * and `wordCountOrderReadMode` while the document is in read mode — a
 * reader often wants "what's left" first and the whole-doc number last,
 * an editor the reverse.
 *
 * Deliberately dependency-free: settings.ts validates stored values
 * with `isWordCountOrder`, and live-read-time.ts (which imports
 * settings) does the ordering — this module sits below both so neither
 * has to import the other.
 */
export type WordCountOrder =
  | 'doc-container-remaining'
  | 'doc-remaining-container'
  | 'container-doc-remaining'
  | 'container-remaining-doc'
  | 'remaining-doc-container'
  | 'remaining-container-doc';
export type WordCountSegmentId = 'doc' | 'container' | 'remaining';
export const DEFAULT_WORD_COUNT_ORDER: WordCountOrder = 'doc-container-remaining';
/** Every permutation, labelled the way the bar labels the segments. */
export const WORD_COUNT_ORDERS: readonly { value: WordCountOrder; label: string }[] = [
  { value: 'doc-container-remaining', label: 'Doc · Card · Left' },
  { value: 'doc-remaining-container', label: 'Doc · Left · Card' },
  { value: 'container-doc-remaining', label: 'Card · Doc · Left' },
  { value: 'container-remaining-doc', label: 'Card · Left · Doc' },
  { value: 'remaining-doc-container', label: 'Left · Doc · Card' },
  { value: 'remaining-container-doc', label: 'Left · Card · Doc' },
];
export function isWordCountOrder(v: unknown): v is WordCountOrder {
  return typeof v === 'string' && WORD_COUNT_ORDERS.some((o) => o.value === v);
}
/** Arrange the three (each optional) segments in `order`; unknown
 *  orders fall back to the default so a bad stored value never hides a
 *  readout. */
export function orderWordCountSegments(
  order: string,
  segments: Record<WordCountSegmentId, string | null>,
): string[] {
  const ids = (isWordCountOrder(order) ? order : DEFAULT_WORD_COUNT_ORDER).split('-') as WordCountSegmentId[];
  return ids.map((id) => segments[id]).filter((s): s is string => s !== null);
}

