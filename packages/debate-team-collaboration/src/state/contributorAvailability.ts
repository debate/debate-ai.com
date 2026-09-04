/**
 * @fileoverview Persistent storage for `research-task-routing.ts`'s
 * `ContributorAvailability` records, keyed by `contributorId` — half of the
 * "(a) persisted contributor profiles (skill level, active task count) and
 * a persisted task queue" follow-up named in the "Research Task Routing"
 * slice in TODO.md. Stores a contributor's routing profile in localStorage,
 * mirroring the existing `judgeProfiles.ts`/`brainstormIdeas.ts` persistence
 * convention (SSR/no-storage-safe, corrupt or missing JSON degrades to an
 * empty list rather than throwing). Task queue persistence is now covered by
 * `routedTaskQueues.ts`.
 *
 * `recordPersistedTaskAssigned`/`recordPersistedTaskCompleted` close the
 * "(a) wiring real task-assignment/completion events to keep a persisted
 * profile's `activeTaskCount` accurate" follow-up named under the "Research
 * Task Routing" bullet in TODO.md — they apply a `+1`/`-1` delta to a stored
 * profile's `activeTaskCount` and save the result, rather than requiring a
 * caller to read, mutate, and re-save the profile itself.
 * `routedTaskQueues.ts`'s `buildAndPersistRoutingResult`/
 * `completePersistedRoutedTask` call these on the actual assignment/
 * completion events (routing a task, marking one done).
 *
 * @module state/contributorAvailability
 */

import type { ContributorAvailability } from "debate-research-evidence/src/lib/research-task-routing";

const STORAGE_KEY = "contributorAvailability";

function readAll(): ContributorAvailability[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ContributorAvailability[]) : [];
  } catch {
    return [];
  }
}

function writeAll(profiles: ContributorAvailability[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

/** Lists every persisted contributor-availability profile. */
export function listContributorAvailability(): ContributorAvailability[] {
  return readAll();
}

/** Looks up a single persisted contributor-availability profile by `contributorId`, if any. */
export function getContributorAvailability(contributorId: string): ContributorAvailability | undefined {
  return readAll().find((profile) => profile.contributorId === contributorId);
}

/** Saves a contributor-availability profile, overwriting any existing record with the same `contributorId`. */
export function saveContributorAvailability(profile: ContributorAvailability): void {
  const profiles = readAll();
  const index = profiles.findIndex((existing) => existing.contributorId === profile.contributorId);
  if (index === -1) {
    profiles.push(profile);
  } else {
    profiles[index] = profile;
  }
  writeAll(profiles);
}

/** Deletes a persisted contributor-availability profile by `contributorId`; a no-op if it isn't stored. */
export function deleteContributorAvailability(contributorId: string): void {
  writeAll(readAll().filter((profile) => profile.contributorId !== contributorId));
}

/**
 * Applies a delta to a stored profile's `activeTaskCount`, floored at `0`,
 * and saves the result. Returns the updated profile, or `undefined` — leaving
 * storage untouched — if no profile is stored for `contributorId`.
 */
function adjustPersistedActiveTaskCount(contributorId: string, delta: number): ContributorAvailability | undefined {
  const profile = getContributorAvailability(contributorId);
  if (!profile) return undefined;

  const updated: ContributorAvailability = {
    ...profile,
    activeTaskCount: Math.max(0, profile.activeTaskCount + delta),
  };
  saveContributorAvailability(updated);
  return updated;
}

/**
 * Records that a contributor was just assigned a task — increments their
 * stored `activeTaskCount` by one and saves the result. Returns the updated
 * profile, or `undefined` if no profile is stored for `contributorId`.
 */
export function recordPersistedTaskAssigned(contributorId: string): ContributorAvailability | undefined {
  return adjustPersistedActiveTaskCount(contributorId, 1);
}

/**
 * Records that a contributor just completed a task — decrements their
 * stored `activeTaskCount` by one (never below zero) and saves the result.
 * Returns the updated profile, or `undefined` if no profile is stored for
 * `contributorId`.
 */
export function recordPersistedTaskCompleted(contributorId: string): ContributorAvailability | undefined {
  return adjustPersistedActiveTaskCount(contributorId, -1);
}
