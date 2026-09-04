/**
 * @fileoverview Persistent storage for a round's chosen `ArgumentTreeFilter`,
 * keyed by `roundId` — the "(c) persisting the user's chosen filter state
 * per round" follow-up named in the `flow/argument-tree.ts` slice for idea
 * #10 ("Outline Filters and Argument Tree View") in TODO.md. Stores
 * selections in localStorage, mirroring the existing
 * `judgeParadigmSelections.ts`/`opponentPersonaSelections.ts` persistence
 * convention.
 *
 * @module state/argumentTreeFilters
 */

import type { ArgumentTreeFilter } from "debate-round/src/flow/argument-tree";

export type ArgumentTreeFilterSelection = {
  roundId: string;
  filter: ArgumentTreeFilter;
};

const STORAGE_KEY = "argumentTreeFilters";

function readAll(): ArgumentTreeFilterSelection[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ArgumentTreeFilterSelection[]) : [];
  } catch {
    return [];
  }
}

function writeAll(selections: ArgumentTreeFilterSelection[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(selections));
}

/** Lists every persisted argument-tree filter selection. */
export function listArgumentTreeFilterSelections(): ArgumentTreeFilterSelection[] {
  return readAll();
}

/** Looks up the persisted argument-tree filter selection for a round, if any. */
export function getArgumentTreeFilterSelection(roundId: string): ArgumentTreeFilterSelection | undefined {
  return readAll().find((selection) => selection.roundId === roundId);
}

/** Saves a round's argument-tree filter selection, overwriting any existing selection for that `roundId`. */
export function saveArgumentTreeFilterSelection(selection: ArgumentTreeFilterSelection): void {
  const selections = readAll();
  const index = selections.findIndex((existing) => existing.roundId === selection.roundId);
  if (index === -1) {
    selections.push(selection);
  } else {
    selections[index] = selection;
  }
  writeAll(selections);
}

/** Deletes a round's persisted argument-tree filter selection; a no-op if it isn't stored. */
export function deleteArgumentTreeFilterSelection(roundId: string): void {
  writeAll(readAll().filter((selection) => selection.roundId !== roundId));
}
