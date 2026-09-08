/**
 * @fileoverview Persistent storage for `team-collaboration-mode.ts`'s
 * `SprintSession` records — the "calendar scheduling for sprint sessions"
 * follow-up named under the "🤝 Team Collaboration Mode" bullet in TODO.md.
 * Stores sessions in localStorage, mirroring `state/sprintNotes.ts`'s exact
 * persistence convention.
 *
 * `isValidSprintSession`/`MAX_SAVED_SPRINT_SESSION_BYTES`/`adoptSprintSession`
 * close this bullet's "Scheduled sessions ... local-only (no account sync
 * yet)" Known gap: they're shared with the `/api/sprint-sessions` D1-backed
 * routes (`apps/debate-ai.com`) and `hooks/useSprintSessionsSync.ts`,
 * mirroring `debate-community`'s `state/dailyBestCardComments.ts` split — a
 * session is scheduled once and only ever cancelled (never edited), the same
 * add/delete-only shape a comment has, so there's nothing to reconcile on a
 * shared id beyond filling gaps in either direction.
 *
 * @module state/sprintSessions
 */

import type { SprintSession } from "../lib/team-collaboration-mode";
import { getSessionsForTopic, MAX_SESSION_TITLE_LENGTH } from "../lib/team-collaboration-mode";

const STORAGE_KEY = "sprintSessions";

/** Hard cap on a single session's JSON size — generous for even a max-length title, well short of D1's row-size limits. */
export const MAX_SAVED_SPRINT_SESSION_BYTES = 5_000;

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

/**
 * Upserts a session as-is, keyed by `id` — used to adopt a remote copy
 * during account merge (mirrors `state/dailyBestCardComments.ts#adoptDailyBestCardComment`),
 * not for scheduling a new local session (use `saveSprintSession` with a
 * `createSprintSession`-built record).
 */
export function adoptSprintSession(session: SprintSession): void {
  saveSprintSession(session);
}

/**
 * Structural validator for an untrusted (e.g. parsed request-body JSON)
 * value claiming to be a `SprintSession`.
 */
export function isValidSprintSession(value: unknown): value is SprintSession {
  if (typeof value !== "object" || value === null) return false;
  const session = value as Record<string, unknown>;

  if (typeof session.id !== "string" || session.id.trim().length === 0) return false;
  if (typeof session.topic !== "string" || session.topic.trim().length === 0) return false;
  if (typeof session.title !== "string" || session.title.trim().length === 0) return false;
  if (session.title.length > MAX_SESSION_TITLE_LENGTH) return false;
  if (typeof session.scheduledDayKey !== "string" || !DAY_KEY_PATTERN.test(session.scheduledDayKey)) return false;
  if (typeof session.createdAt !== "number") return false;

  return true;
}
