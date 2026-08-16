/**
 * @fileoverview Persistent storage for `contribution-leaderboard.ts`'s
 * `AttributedContribution` records — the "(a) wiring a `contributorId` into
 * wherever contributions are eventually persisted" follow-up named in that
 * slice for the "Contribution Leaderboard" idea in TODO.md. Stores
 * contributions in localStorage, mirroring the existing
 * `sprintNotes.ts`/`peerReviews.ts` persistence convention. `AttributedContribution`
 * already extends `community-rating.ts`'s `CommunityContribution`, so this
 * store also persists what a "Community-Rated Summaries and Highlights"
 * (idea #11) contribution needs.
 *
 * @module state/contributions
 */

import type { AttributedContribution } from "../lib/contribution-leaderboard";
import { groupContributionsByContributor } from "../lib/contribution-leaderboard";

const STORAGE_KEY = "contributions";

function readAll(): AttributedContribution[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AttributedContribution[]) : [];
  } catch {
    return [];
  }
}

function writeAll(contributions: AttributedContribution[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contributions));
}

/** Lists every persisted contribution, across all contributors. */
export function listContributions(): AttributedContribution[] {
  return readAll();
}

/** Lists every persisted contribution attributed to one contributor. */
export function listContributionsByContributor(contributorId: string): AttributedContribution[] {
  return groupContributionsByContributor(readAll()).get(contributorId) ?? [];
}

/** Looks up a single persisted contribution by id, if any. */
export function getContribution(id: string): AttributedContribution | undefined {
  return readAll().find((contribution) => contribution.id === id);
}

/** Saves a contribution, overwriting any existing record with the same id. */
export function saveContribution(contribution: AttributedContribution): void {
  const contributions = readAll();
  const index = contributions.findIndex((existing) => existing.id === contribution.id);
  if (index === -1) {
    contributions.push(contribution);
  } else {
    contributions[index] = contribution;
  }
  writeAll(contributions);
}

/** Deletes a persisted contribution by id; a no-op if it isn't stored. */
export function deleteContribution(id: string): void {
  writeAll(readAll().filter((contribution) => contribution.id !== id));
}
