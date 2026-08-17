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
 * `buildBrainstormBoardsPanelView` and `upvotePersistedBrainstormIdea` are a
 * second, thin slice closing follow-up "(b) a brainstorm-panel UI for live
 * squad submission/upvoting" named under the "Team Brainstorm Assist"
 * bullet — the former groups every persisted idea into its board and ranks
 * each board for display, the latter applies an upvote to a single stored
 * idea, both reusing `team-brainstorm-assist.ts`'s pure
 * `groupIdeasByBoard`/`buildBrainstormBoard` rather than reimplementing
 * grouping or ranking here.
 *
 * @module state/brainstormIdeas
 */

import { buildBrainstormBoard, groupIdeasByBoard, type BrainstormBoard, type BrainstormIdea } from "../lib/team-brainstorm-assist";

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

/**
 * Builds every persisted idea's board (grouped by argBlock + category, each
 * ranked via `buildBrainstormBoard`), sorted by argBlock then category for a
 * stable panel display order.
 */
export function buildBrainstormBoardsPanelView(): BrainstormBoard[] {
  const ideas = readAll();
  const byBoard = groupIdeasByBoard(ideas);
  return Array.from(byBoard.values())
    .map((boardIdeas) => buildBrainstormBoard(boardIdeas[0].argBlock, boardIdeas[0].category, ideas))
    .sort((a, b) => a.argBlock.localeCompare(b.argBlock) || a.category.localeCompare(b.category));
}

/**
 * Upvotes a single persisted idea by id (increments its stored `upvotes` by
 * one and saves it back); a no-op if the id isn't stored.
 */
export function upvotePersistedBrainstormIdea(id: string): void {
  const idea = getBrainstormIdea(id);
  if (!idea) return;
  saveBrainstormIdea({ ...idea, upvotes: idea.upvotes + 1 });
}
