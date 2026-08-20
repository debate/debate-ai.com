/**
 * @fileoverview Persistent storage for `flow/argument-tree.ts`'s derived
 * `ArgumentTreeNode[]` outline, keyed by `roundId` — the data half of the
 * "(a) a React tree/outline panel in debate-round that renders the filtered
 * tree next to (or instead of) FlowSpreadsheet and reads/writes through the
 * persistence store" follow-up named under idea #10 ("Outline Filters and
 * Argument Tree View") in TODO.md. Stores a round's computed tree in
 * localStorage, mirroring the existing
 * `flowSummaries.ts`/`drillSets.ts` persistence convention — the filter
 * *selection* itself already persists separately via
 * `state/argumentTreeFilters.ts`.
 *
 * @module state/argumentTrees
 */

import type { Flow } from "debate-core/src/types/flow";
import { buildArgumentTree, type ArgumentTreeNode } from "../flow/argument-tree";

export type ArgumentTreeRecord = {
  roundId: string;
  tree: ArgumentTreeNode[];
};

const STORAGE_KEY = "argumentTrees";

function readAll(): ArgumentTreeRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ArgumentTreeRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: ArgumentTreeRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Lists every persisted argument tree, across all rounds. */
export function listArgumentTrees(): ArgumentTreeRecord[] {
  return readAll();
}

/** Looks up the persisted argument tree for a round, if any. */
export function getArgumentTree(roundId: string): ArgumentTreeRecord | undefined {
  return readAll().find((record) => record.roundId === roundId);
}

/** Saves a round's argument tree, overwriting any existing record for that `roundId`. */
export function saveArgumentTree(record: ArgumentTreeRecord): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.roundId === record.roundId);
  if (index === -1) {
    records.push(record);
  } else {
    records[index] = record;
  }
  writeAll(records);
}

/** Deletes a round's persisted argument tree; a no-op if it isn't stored. */
export function deleteArgumentTree(roundId: string): void {
  writeAll(readAll().filter((record) => record.roundId !== roundId));
}

/**
 * Derives a round's argument tree from its flowed grid via `buildArgumentTree`
 * and saves the result, returning the saved record. Lets a caller compute and
 * persist a round's outline in one step once an already-flowed `Flow` is
 * available, without hand-building the tree itself.
 */
export function buildAndSaveArgumentTree(
  flow: Pick<Flow, "children" | "columns">,
  roundId: string,
): ArgumentTreeRecord {
  const record: ArgumentTreeRecord = { roundId, tree: buildArgumentTree(flow) };
  saveArgumentTree(record);
  return record;
}

/**
 * Every persisted argument tree, sorted by `roundId` for a stable display
 * order — the "(a) a React tree/outline panel ... that reads/writes through
 * the persistence store" follow-up named under idea #10 ("Outline Filters
 * and Argument Tree View") in TODO.md. Used by
 * `panels/ArgumentTreePanel.tsx`.
 */
export function buildArgumentTreesPanelView(): ArgumentTreeRecord[] {
  return [...listArgumentTrees()].sort((a, b) => a.roundId.localeCompare(b.roundId));
}

/**
 * Like {@link buildAndSaveArgumentTree}, but skips the write (and returns
 * `undefined`) when the derived tree is structurally identical to what's
 * already stored for `roundId`. Used by `hooks/useFlowEffects.ts`'s
 * `useArgumentTreeAutoSync`, which calls this on a debounce tick as a round
 * is flowed — without this check, every tick would rewrite localStorage
 * even when nothing about the flow's derived outline actually changed.
 */
export function buildAndSaveArgumentTreeIfChanged(
  flow: Pick<Flow, "children" | "columns">,
  roundId: string,
): ArgumentTreeRecord | undefined {
  const tree = buildArgumentTree(flow);
  const existing = getArgumentTree(roundId);
  if (existing && JSON.stringify(existing.tree) === JSON.stringify(tree)) {
    return undefined;
  }
  const record: ArgumentTreeRecord = { roundId, tree };
  saveArgumentTree(record);
  return record;
}
