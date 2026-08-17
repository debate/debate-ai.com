/**
 * @fileoverview Persistent storage for `research-task-routing.ts`'s
 * `ContributorAvailability` records, keyed by `contributorId` — half of the
 * "(a) persisted contributor profiles (skill level, active task count) and
 * a persisted task queue" follow-up named in the "Research Task Routing"
 * slice in TODO.md. Stores a contributor's routing profile in localStorage,
 * mirroring the existing `judgeProfiles.ts`/`brainstormIdeas.ts` persistence
 * convention (SSR/no-storage-safe, corrupt or missing JSON degrades to an
 * empty list rather than throwing). This is a persistence slice only — task
 * queue persistence and wiring real task-assignment events into
 * `activeTaskCount` remain unstarted follow-ups.
 *
 * @module state/contributorAvailability
 */

import type { ContributorAvailability } from "../lib/research-task-routing";

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
