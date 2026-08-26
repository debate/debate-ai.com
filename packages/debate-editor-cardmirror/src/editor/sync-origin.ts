/**
 * Sync-origin transaction tagging.
 *
 * A sync-origin transaction carries remote content that has already been
 * merged into a shared document by a sync layer (collaborative editing) —
 * by the time it reaches the editor it is a fact, not a proposal.
 * Rejecting one desynchronizes the local EditorState from the shared
 * state, and nothing downstream can detect or heal that. Every
 * `filterTransaction` in the editor must therefore admit sync-origin
 * transactions unconditionally; plugins that guard document regions
 * react to an overlapping sync edit by releasing their guard (see the
 * AI edit coordinator) rather than by blocking.
 */
import type { Transaction } from 'prosemirror-state';

export const SYNC_ORIGIN_META = 'syncOrigin';

/** Tag `tr` as carrying already-merged remote content. */
export function markSyncOrigin(tr: Transaction): Transaction {
  return tr.setMeta(SYNC_ORIGIN_META, true);
}

export function isSyncOrigin(tr: Transaction): boolean {
  return tr.getMeta(SYNC_ORIGIN_META) === true;
}
