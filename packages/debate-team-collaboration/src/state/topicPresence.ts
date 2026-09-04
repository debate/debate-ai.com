/**
 * @fileoverview Persistent storage for `topic-presence.ts`'s
 * `PresenceHeartbeat` records — the "(c) a presence/live-status signal for
 * who's currently active" follow-up named under the "🤝 Team Collaboration
 * Mode" bullet in TODO.md. Stores heartbeats in localStorage, mirroring the
 * existing `sprintNotes.ts`/`prepNotes.ts` persistence convention.
 *
 * @module state/topicPresence
 */

import type { ActiveContributor, PresenceHeartbeat } from "../lib/topic-presence";
import { listActiveContributors, recordPresenceHeartbeat } from "../lib/topic-presence";

const STORAGE_KEY = "topicPresenceHeartbeats";

function readAll(): PresenceHeartbeat[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PresenceHeartbeat[]) : [];
  } catch {
    return [];
  }
}

function writeAll(heartbeats: PresenceHeartbeat[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(heartbeats));
}

/** Lists every persisted heartbeat, across all topics and contributors. */
export function listPresenceHeartbeats(): PresenceHeartbeat[] {
  return readAll();
}

/**
 * Records (or bumps) `contributorId`'s "I'm active" heartbeat for `topic`
 * and persists it, applying `recordPresenceHeartbeat`'s upsert against the
 * currently stored heartbeats rather than introducing new mutation logic.
 */
export function recordPersistedPresenceHeartbeat(topic: string, contributorId: string, atMs: number): void {
  writeAll(recordPresenceHeartbeat(readAll(), topic, contributorId, atMs));
}

/**
 * Lists every contributor currently active in `topic` as of `nowMs`, applying
 * `listActiveContributors` against the persisted heartbeats.
 */
export function listPersistedActiveContributors(
  topic: string,
  nowMs: number,
  staleAfterMs?: number,
): ActiveContributor[] {
  return listActiveContributors(readAll(), topic, nowMs, staleAfterMs);
}
