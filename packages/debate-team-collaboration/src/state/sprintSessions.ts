/**
 * @fileoverview Persistent storage for `team-collaboration-mode.ts`'s
 * `SprintSession` records — the "calendar scheduling for sprint sessions"
 * follow-up named under the "🤝 Team Collaboration Mode" bullet in TODO.md.
 * Stores sessions in localStorage, mirroring `state/sprintNotes.ts`'s exact
 * persistence convention.
 *
 * @module state/sprintSessions
 */

import type { SprintSession } from "../lib/team-collaboration-mode";
import { getSessionsForTopic } from "../lib/team-collaboration-mode";

const STORAGE_KEY = "sprintSessions";

function readAll(): SprintSession[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SprintSession[]) : [];
  } catch {
    return [];
  }
}

function writeAll(sessions: SprintSession[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

/** Lists every persisted sprint session, across all topics. */
export function listSprintSessions(): SprintSession[] {
  return readAll();
}

/** Lists every persisted sprint session for one topic, soonest first. */
export function listSprintSessionsForTopic(topic: string): SprintSession[] {
  return getSessionsForTopic(readAll(), topic);
}

/** Looks up a single persisted sprint session by id, if any. */
export function getSprintSession(id: string): SprintSession | undefined {
  return readAll().find((session) => session.id === id);
}

/** Saves a sprint session, overwriting any existing record with the same id. */
export function saveSprintSession(session: SprintSession): void {
  const sessions = readAll();
  const index = sessions.findIndex((existing) => existing.id === session.id);
  if (index === -1) {
    sessions.push(session);
  } else {
    sessions[index] = session;
  }
  writeAll(sessions);
}

/** Deletes a persisted sprint session by id; a no-op if it isn't stored. */
export function deleteSprintSession(id: string): void {
  writeAll(readAll().filter((session) => session.id !== id));
}
