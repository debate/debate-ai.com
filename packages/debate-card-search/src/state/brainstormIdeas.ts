/**
 * @fileoverview Persistent storage for `team-brainstorm-assist.ts`'s
 * `BrainstormIdea` records — the "(c) persisting submitted ideas and votes"
 * follow-up named in that slice for the "Team Brainstorm Assist" bullet in
 * TODO.md. Stores an idea in localStorage, mirroring the existing
 * `groupChallenges.ts`/`peerReviews.ts`/`contributions.ts` persistence
 * convention (SSR/no-storage-safe, corrupt or missing JSON degrades to an
 * empty list rather than throwing). This is a persistence slice only — it
 * stores whatever `BrainstormIdea` a caller passes in verbatim; ranking and
 * board composition stay in `team-brainstorm-assist.ts`'s pure
 * `rankBrainstormIdeas`/`buildBrainstormBoard`.
 *
 * @module state/brainstormIdeas
 */

import type { BrainstormIdea } from "../lib/team-brainstorm-assist";

const STORAGE_KEY = "brainstormIdeas";

function readAll(): BrainstormIdea[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BrainstormIdea[]) : [];
  } catch {
    return [];
  }
}

function writeAll(ideas: BrainstormIdea[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ideas));
}

/** Lists every persisted brainstorm idea. */
export function listBrainstormIdeas(): BrainstormIdea[] {
  return readAll();
}

/** Looks up a single persisted brainstorm idea by id, if any. */
export function getBrainstormIdea(id: string): BrainstormIdea | undefined {
  return readAll().find((idea) => idea.id === id);
}

/** Saves a brainstorm idea, overwriting any existing record with the same id. */
export function saveBrainstormIdea(idea: BrainstormIdea): void {
  const ideas = readAll();
  const index = ideas.findIndex((existing) => existing.id === idea.id);
  if (index === -1) {
    ideas.push(idea);
  } else {
    ideas[index] = idea;
  }
  writeAll(ideas);
}

/** Deletes a persisted brainstorm idea by id; a no-op if it isn't stored. */
export function deleteBrainstormIdea(id: string): void {
  writeAll(readAll().filter((idea) => idea.id !== id));
}
