/**
 * Where a remote change reaches the live grid.
 *
 * The registry exists for the same reason `hotInstance` does: the collab
 * runtime must not import a React component, and the grid must not import the
 * session. `HotGrid` registers one handler while it is mounted, and the
 * runtime calls it when a peer's change lands.
 *
 * Nothing here decides anything. The decision is `planRemoteApply`; this is
 * only the wire between it and the grid that has to obey it.
 */

import type { CollabDoc } from "../collab/types";

/** Applies a merged document to the grid, honouring the apply rules. */
export type RemoteApplyHandler = (before: CollabDoc, after: CollabDoc) => void;

let handler: RemoteApplyHandler | null = null;

/** HotGrid registers on mount and clears on unmount. */
export function setRemoteApply(next: RemoteApplyHandler | null): void {
    handler = next;
}

/**
 * Hands a change to the grid. A no-op with no grid mounted, which is ordinary:
 * the replica is already correct and the grid reloads from it on open.
 */
export function applyRemote(before: CollabDoc, after: CollabDoc): void {
    handler?.(before, after);
}
