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
 * `buildBrainstormBoardsPanelViewForTopic` closes the "boards aren't seeded
 * from the coverage-gap prompts" gap noted in
 * `docs/features/brainstorm-board.md` — it composes a topic's persisted
 * coverage report (`state/trackedArguments.ts`'s
 * `buildPersistedTopicCoverageReport`) with the pure
 * `team-brainstorm-assist.ts` `buildBrainstormBoardsForCoverageGaps` to
 * produce one board per under-covered tracked argument/category pair (with
 * its seeding prompt visible even before anyone has submitted an idea),
 * merged with every other board that already has at least one submitted
 * idea, so a coverage-gap board that later gets ideas keeps showing them
 * and a non-coverage-gap board with ideas still appears.
 *
 * `mergePersistedBrainstormIdeas` closes the "no reviewer/moderator merge
 * action for ideas flagged as likely duplicates" Known gap noted in
 * `docs/features/brainstorm-board.md` — it applies the pure
 * `team-brainstorm-assist.ts` `mergeBrainstormIdeas` against the two stored
 * ideas and deletes the merged-away duplicate, rather than introducing new
 * merge logic here.
 *
 * @module state/brainstormIdeas
 */

import { buildBrainstormBoard, buildBrainstormBoardsForCoverageGaps, buildEvidenceEntryFromBrainstormIdea, groupIdeasByBoard, mergeBrainstormIdeas, type BrainstormBoard, type BrainstormIdea } from "../lib/team-brainstorm-assist";
import type { EvidenceLibraryEntry } from "../lib/shared-evidence-library";
import { buildPersistedTopicCoverageReport } from "./trackedArguments";
import { getEvidenceLibraryEntry, saveEvidenceLibraryEntry } from "./evidenceLibraryEntries";

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
 * Builds a topic's brainstorm boards seeded from its coverage gaps: one
 * board per under-covered tracked argument/category pair (via
 * `buildPersistedTopicCoverageReport` + `buildBrainstormBoardsForCoverageGaps`),
 * each populated with whatever ideas have already been submitted for it,
 * merged with every other persisted board that has at least one submitted
 * idea but isn't itself a coverage-gap seed. Sorted by argBlock then
 * category for a stable panel display order, same as
 * `buildBrainstormBoardsPanelView`.
 */
export function buildBrainstormBoardsPanelViewForTopic(topic: string): BrainstormBoard[] {
  const ideas = readAll();
  const report = buildPersistedTopicCoverageReport(topic);
  const seededBoards = buildBrainstormBoardsForCoverageGaps(report, ideas);
  const seededKeys = new Set(seededBoards.map((board) => `${board.argBlock}::${board.category}`));
  const otherBoards = buildBrainstormBoardsPanelView().filter(
    (board) => !seededKeys.has(`${board.argBlock}::${board.category}`),
  );
  return [...seededBoards, ...otherBoards].sort(
    (a, b) => a.argBlock.localeCompare(b.argBlock) || a.category.localeCompare(b.category),
  );
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

/**
 * Merges a duplicate-flagged idea into another stored idea on the same
 * board (via `mergeBrainstormIdeas`), saving the combined-upvote result
 * under `targetId` and deleting `duplicateId`. A no-op if either id isn't
 * stored; propagates `mergeBrainstormIdeas`'s error for a same-id or
 * cross-board merge attempt.
 */
export function mergePersistedBrainstormIdeas(targetId: string, duplicateId: string): void {
  const target = getBrainstormIdea(targetId);
  const duplicate = getBrainstormIdea(duplicateId);
  if (!target || !duplicate) return;
  saveBrainstormIdea(mergeBrainstormIdeas(target, duplicate));
  deleteBrainstormIdea(duplicateId);
}

/**
 * Deterministic id a sent brainstorm idea's Argument Library entry is stored
 * under — see `buildEvidenceEntryFromBrainstormIdea`.
 */
function argumentLibraryEntryIdForIdea(ideaId: string): string {
  return `brainstorm-${ideaId}`;
}

/**
 * Whether a brainstorm idea has already been sent to the Argument Library —
 * the "already sent" check the panel uses to swap the "Send to Argument
 * Library" action for a confirmation badge instead of offering to send the
 * same idea again.
 */
export function isBrainstormIdeaInArgumentLibrary(ideaId: string): boolean {
  return getEvidenceLibraryEntry(argumentLibraryEntryIdForIdea(ideaId)) !== undefined;
}

/**
 * Sends a brainstorm idea to the Argument Library — the "a one-click 'send
 * top idea to Argument Library' action" follow-up named under the "🧠 Team
 * Brainstorm Assist" bullet in TODO.md. Composes the pure
 * `buildEvidenceEntryFromBrainstormIdea` with this idea's own id-derived
 * entry id, stamps `createdAt` here (see that function's docs on why it
 * doesn't stamp one itself), and saves it through the existing
 * `evidenceLibraryEntries.ts` store via `saveEvidenceLibraryEntry` — the
 * exact same store `EvidenceLibraryPanel`/`ArgumentLibraryPanel` already
 * read, so a sent idea shows up in the Argument Library immediately, filed
 * under `topic`/`caseArea` like any other entry. Sending the same idea again
 * (same `idea.id`) overwrites its existing entry rather than creating a
 * duplicate, since `saveEvidenceLibraryEntry` upserts by id.
 */
export function sendBrainstormIdeaToArgumentLibrary(
  idea: BrainstormIdea,
  topic: string,
  caseArea: string,
): EvidenceLibraryEntry {
  const entry: EvidenceLibraryEntry = {
    ...buildEvidenceEntryFromBrainstormIdea(idea, topic, caseArea),
    createdAt: Date.now(),
  };
  saveEvidenceLibraryEntry(entry);
  return entry;
}
