/**
 * Round-counting guard for the normalizer `appendTransaction` plugins
 * (absorb, cite-classifier, named-style-normalizer).
 *
 * ProseMirror re-runs `appendTransaction` until no plugin appends, with
 * no built-in bound — two normalizers that each "fix" the other's output
 * wedge the renderer in an infinite dispatch loop. Every normalizer
 * routes its appended transaction through `guardNormalizerTr`, which
 * stamps a round counter derived from the incoming transactions and
 * refuses to append past `NORMALIZER_ROUND_CAP`.
 *
 * The cap is a backstop, not a budget: the normalizers converge in one
 * round on well-formed input, and a legitimate cascade (absorb moving a
 * paragraph into a card, then the classifier retyping it) finishes in
 * two. Hitting the cap means a normalizer fight; the guard drops that
 * round's fix and warns instead of wedging.
 */
import type { Transaction } from 'prosemirror-state';

/** Set on every guarded normalizer transaction. Lets other plugins
 *  recognize normalizer output (read mode admits it — a normalizer only
 *  fires in response to a transaction that was itself admitted). */
export const NORMALIZER_META = 'normalizerEdit';

export const NORMALIZER_ROUND_META = 'normalizerRound';

export const NORMALIZER_ROUND_CAP = 8;

/** Highest normalizer round among `trs` (0 when none carry the meta). */
export function normalizerRound(trs: readonly Transaction[]): number {
  let max = 0;
  for (const t of trs) {
    const r = t.getMeta(NORMALIZER_ROUND_META) as number | undefined;
    if (typeof r === 'number' && r > max) max = r;
  }
  return max;
}

/**
 * Stamp a normalizer's appended transaction with origin + round metas,
 * or drop it (returning null) when the incoming transactions already
 * reached the round cap.
 */
export function guardNormalizerTr(
  incoming: readonly Transaction[],
  tr: Transaction,
): Transaction | null {
  const round = normalizerRound(incoming);
  if (round >= NORMALIZER_ROUND_CAP) {
    console.warn(
      '[cardmirror] normalizer round cap reached — dropping a normalization pass to avoid a dispatch loop',
    );
    return null;
  }
  tr.setMeta(NORMALIZER_META, true);
  tr.setMeta(NORMALIZER_ROUND_META, round + 1);
  return tr;
}
