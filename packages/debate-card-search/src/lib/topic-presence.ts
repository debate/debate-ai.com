/**
 * @fileoverview Live presence/who's-active signal for a topic sprint — the
 * "(c) a presence/live-status signal for who's currently active" follow-up
 * named under the "🤝 Team Collaboration Mode" bullet in TODO.md ("Let
 * multiple debaters work on the same topic sprint with shared notes,
 * assignments, and live status"). There is no live transport (WebSocket or
 * similar) in this repo, so presence is modeled the same way every other
 * "live" signal here is: a caller-recorded heartbeat with a timestamp, and a
 * contributor counts as "active" only while their most recent heartbeat for
 * that topic is within a freshness window — mirroring how
 * `debate-card-search`'s `daily-quests.ts` treats a mission as "today's" by
 * comparing a timestamp against `now` rather than needing a scheduled job.
 * This is the first slice only — it works entirely off a caller-supplied
 * heartbeat list; it doesn't persist heartbeats or render a presence widget.
 * See `state/topicPresence.ts` and `panels/SprintNotesPanel.tsx`.
 *
 * @module lib/topic-presence
 */

/** One contributor's most recent "I'm active in this topic" signal. */
export interface PresenceHeartbeat {
  topic: string;
  contributorId: string;
  /** Epoch ms this heartbeat was last recorded. */
  lastSeenAt: number;
}

/** A contributor still within the freshness window as of `now`. */
export interface ActiveContributor {
  contributorId: string;
  lastSeenAt: number;
}

/** How long a heartbeat counts as "active" before it goes stale, by default. */
export const DEFAULT_PRESENCE_STALE_AFTER_MS = 5 * 60 * 1000;

/**
 * Returns a copy of `heartbeats` with `contributorId`'s heartbeat for `topic`
 * upserted to `atMs` — one heartbeat per (topic, contributorId) pair, so a
 * contributor re-marking themselves active just bumps their existing
 * timestamp rather than accumulating duplicates.
 */
export function recordPresenceHeartbeat(
  heartbeats: PresenceHeartbeat[],
  topic: string,
  contributorId: string,
  atMs: number,
): PresenceHeartbeat[] {
  const index = heartbeats.findIndex((h) => h.topic === topic && h.contributorId === contributorId);
  const updated: PresenceHeartbeat = { topic, contributorId, lastSeenAt: atMs };

  if (index === -1) {
    return [...heartbeats, updated];
  }
  const next = [...heartbeats];
  next[index] = updated;
  return next;
}

/**
 * Lists every contributor whose most recent heartbeat for `topic` is within
 * `staleAfterMs` of `nowMs`, most-recently-active first.
 */
export function listActiveContributors(
  heartbeats: PresenceHeartbeat[],
  topic: string,
  nowMs: number,
  staleAfterMs: number = DEFAULT_PRESENCE_STALE_AFTER_MS,
): ActiveContributor[] {
  return heartbeats
    .filter((h) => h.topic === topic && nowMs - h.lastSeenAt <= staleAfterMs && nowMs >= h.lastSeenAt)
    .map(({ contributorId, lastSeenAt }) => ({ contributorId, lastSeenAt }))
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

/**
 * Renders a topic's active roster as a short status line for a presence
 * widget, e.g. "3 active now: alice, bob, carol" or "No one active right
 * now."
 */
export function buildPresenceSummaryText(active: ActiveContributor[]): string {
  if (active.length === 0) return "No one active right now.";
  const names = active.map((a) => a.contributorId).join(", ");
  return `${active.length} active now: ${names}`;
}
