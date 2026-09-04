/**
 * @fileoverview Live "who's editing now" presence for a flow — closes the
 * "Live 'who's editing now' presence indicators alongside the existing
 * merge preview" follow-up named under TODO.md idea #16 ("Shared,
 * Ai-Generated Debate Flow").
 *
 * Mirrors `debate-team-collaboration`'s `lib/topic-presence.ts` heartbeat
 * model — there is no push transport (WebSocket/Durable Object) in this
 * repo, so presence is a caller-recorded heartbeat with a timestamp, and a
 * collaborator counts as "active" only while their most recent heartbeat
 * for a flow is within a freshness window. Unlike topic presence (which
 * only tracks local, same-browser heartbeats), a flow's heartbeats are also
 * pushed/pulled through `/api/flow-sync`'s existing live-sync infrastructure
 * (see `flow/flow-presence-client.ts`, `hooks/useFlowPresencePolling.ts`),
 * since "who else is editing this flow right now" is only useful across
 * different collaborators' devices.
 *
 * This module is the pure data layer only — see `state/flowPresence.ts` for
 * persistence and `hooks/useFlowPresencePolling.ts` for the poll loop that
 * drives it.
 *
 * @module flow/flow-presence
 */

/** One collaborator's most recent "I'm actively editing this flow" signal. */
export interface FlowPresenceHeartbeat {
  flowId: number;
  authorId: string;
  /** Epoch ms this heartbeat was last recorded. */
  lastSeenAt: number;
}

/** A collaborator still within the freshness window as of `now`. */
export interface ActiveFlowEditor {
  authorId: string;
  lastSeenAt: number;
}

/**
 * How long a heartbeat counts as "active" before it goes stale, by default —
 * a little under 4x `hooks/useFlowPresencePolling.ts`'s default poll
 * interval (4000ms), so one or two missed polls doesn't immediately drop a
 * still-active collaborator.
 */
export const DEFAULT_FLOW_PRESENCE_STALE_AFTER_MS = 15_000;

/**
 * Returns a copy of `heartbeats` with `authorId`'s heartbeat for `flowId`
 * upserted to `atMs` — one heartbeat per (flowId, authorId) pair, so a
 * collaborator re-heartbeating just bumps their existing timestamp rather
 * than accumulating duplicates.
 */
export function recordFlowPresenceHeartbeat(
  heartbeats: FlowPresenceHeartbeat[],
  flowId: number,
  authorId: string,
  atMs: number,
): FlowPresenceHeartbeat[] {
  const index = heartbeats.findIndex((h) => h.flowId === flowId && h.authorId === authorId);
  const updated: FlowPresenceHeartbeat = { flowId, authorId, lastSeenAt: atMs };

  if (index === -1) {
    return [...heartbeats, updated];
  }
  const next = [...heartbeats];
  next[index] = updated;
  return next;
}

/** Options for {@link listActiveFlowEditors}. */
export interface ListActiveFlowEditorsOptions {
  /** How long a heartbeat counts as active. Defaults to {@link DEFAULT_FLOW_PRESENCE_STALE_AFTER_MS}. */
  staleAfterMs?: number;
  /** A collaborator id to omit from the result — typically the viewer's own. */
  excludeAuthorId?: string;
}

/**
 * Lists every collaborator whose most recent heartbeat for `flowId` is
 * within the freshness window of `nowMs`, most-recently-active first.
 */
export function listActiveFlowEditors(
  heartbeats: FlowPresenceHeartbeat[],
  flowId: number,
  nowMs: number,
  options: ListActiveFlowEditorsOptions = {},
): ActiveFlowEditor[] {
  const { staleAfterMs = DEFAULT_FLOW_PRESENCE_STALE_AFTER_MS, excludeAuthorId } = options;
  return heartbeats
    .filter(
      (h) =>
        h.flowId === flowId &&
        nowMs - h.lastSeenAt <= staleAfterMs &&
        nowMs >= h.lastSeenAt &&
        (excludeAuthorId === undefined || h.authorId !== excludeAuthorId),
    )
    .map(({ authorId, lastSeenAt }) => ({ authorId, lastSeenAt }))
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

/**
 * Renders a flow's active-editor roster as a short status line, e.g. "2
 * teammates editing now: alice, bob" or "No one else editing right now."
 */
export function buildFlowPresenceSummaryText(active: ActiveFlowEditor[]): string {
  if (active.length === 0) return "No one else editing right now.";
  const names = active.map((a) => a.authorId).join(", ");
  const noun = active.length === 1 ? "teammate" : "teammates";
  return `${active.length} ${noun} editing now: ${names}`;
}
