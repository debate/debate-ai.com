/**
 * @fileoverview Persistent storage for `group-challenges.ts`'s `GroupChallenge`
 * config — the "(c) persisting challenges" follow-up named in that slice for
 * the "Coaching Programs and Group Challenges" idea in TODO.md. Stores a
 * challenge's config in localStorage, mirroring the existing
 * `sprintNotes.ts`/`coachingPrograms.ts` persistence convention
 * (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
 * rather than throwing). This is a config-persistence slice only — a
 * challenge's computed progress (`computeGroupChallengeProgress`) stays
 * session-derived from caller-supplied contributions/win events rather than
 * being stored.
 *
 * @module state/groupChallenges
 */

import type { GroupChallenge } from "../lib/group-challenges";

const STORAGE_KEY = "groupChallenges";

function readAll(): GroupChallenge[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GroupChallenge[]) : [];
  } catch {
    return [];
  }
}

function writeAll(challenges: GroupChallenge[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(challenges));
}

/** Lists every persisted group challenge. */
export function listGroupChallenges(): GroupChallenge[] {
  return readAll();
}

/** Looks up a single persisted group challenge by id, if any. */
export function getGroupChallenge(id: string): GroupChallenge | undefined {
  return readAll().find((challenge) => challenge.id === id);
}

/** Saves a group challenge, overwriting any existing record with the same id. */
export function saveGroupChallenge(challenge: GroupChallenge): void {
  const challenges = readAll();
  const index = challenges.findIndex((existing) => existing.id === challenge.id);
  if (index === -1) {
    challenges.push(challenge);
  } else {
    challenges[index] = challenge;
  }
  writeAll(challenges);
}

/** Deletes a persisted group challenge by id; a no-op if it isn't stored. */
export function deleteGroupChallenge(id: string): void {
  writeAll(readAll().filter((challenge) => challenge.id !== id));
}
