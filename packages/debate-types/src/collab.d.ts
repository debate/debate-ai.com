/**
 * The replicated shape of a round.
 *
 * Every value is a last-writer-wins register, and every container is a plain
 * record keyed by a stable identity, so merging two replicas is a union with a
 * comparison and never a diff. Both the round and a sheet store their scalars
 * as dotted leaf paths rather than named fields: a path a newer build writes
 * survives a merge through an older one for free, which is the one property
 * that cannot be retrofitted once the protocol ships.
 */

/**
 * The clock every replicated value is stamped by.
 *
 * A stamp is a hybrid logical clock: wall time, a counter that breaks ties
 * inside one millisecond, and the writing peer. Wall time is what makes "last
 * typed wins" match what the two debaters saw happen; the counter and the
 * actor make the order total, so last-writer-wins resolves identically on
 * every peer.
 */
export interface Stamp {
  /** Epoch ms, raised to the highest wall time any peer has reported. */
  ms: number;
  /** Distinguishes writes inside one millisecond. */
  counter: number;
  /** The writing peer's EndpointId. "" marks a value seeded from the file. */
  actor: string;
}

/** Everything that crosses the wire or lands in a register. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** One value and the stamp that wrote it. */
export interface Register {
  /** The current value. */
  value: Json;
  /** When and by whom the value was written; the newest stamp wins a merge. */
  stamp: Stamp;
}

/**
 * What a peer may do to one round. A viewer reads it and writes nothing.
 *
 * Per round and never per peer: the same partner is an editor on the case a
 * pair is building together and a viewer on the one they are only being shown,
 * so the grant belongs to the round that made it and not to a row in the
 * contact table.
 */
export type Role = "editor" | "viewer";

/** One cell of a flow sheet, with separate clocks for its text and its formatting. */
export interface CollabCell {
  /** Stored column index, the index `sheet.data` rows already use. */
  col: number;
  /** Immutable fractional index inside the column. */
  rank: string;
  /** Creator. "" marks a cell seeded from the file. Breaks a rank tie. */
  actor: string;
  /** The cell's text; null when it holds none. */
  text: string | null;
  /** Stamp of the last write to `text`. */
  textStamp: Stamp;
  /**
   * `CellMeta` as a bag, so a key a newer build writes survives. Text and
   * meta carry separate stamps: one stamp would let a bold toggle revert a
   * partner's concurrent text.
   */
  meta: Record<string, Json>;
  /** Stamp of the last write to `meta`. */
  metaStamp: Stamp;
  /** Set once. A delete is never undone by a later write. */
  deleted: Stamp | null;
}

/** One sheet of a shared round. */
export interface CollabSheet {
  /** Stable id of the sheet. */
  id: string;
  /** Leaf path to register: `title`, `group`, `order`, `kind`, `startSpeechId`. */
  fields: Record<string, Register>;
  /** Stamp of the deletion, or null while the sheet is live. */
  deleted: Stamp | null;
  /** cellKey to cell, across every column of the sheet. */
  cells: Record<string, CollabCell>;
}

/** A whole shared round: its scalar fields and its sheets. */
export interface CollabDoc {
  /** Stable id of the round. */
  roundId: string;
  /** Leaf path to register: `event`, `firstSide`, and every scouting leaf. */
  round: Record<string, Register>;
  /** Sheets keyed by sheet id. */
  sheets: Record<string, CollabSheet>;
}
