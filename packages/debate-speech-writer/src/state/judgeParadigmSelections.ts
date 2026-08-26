/**
 * @fileoverview Persistent storage for a round's selected `JudgeParadigm`,
 * keyed by `roundId` — the "(c) persisting the selected paradigm per round"
 * follow-up named in the "AI Judge Decision Modes" slice
 * (`judge/judge-paradigms.ts`) in TODO.md's Product Feature Ideas list.
 * Stores the full `JudgeParadigm` (rather than just a builtin id) so a
 * "custom" paradigm built with `buildCustomJudgeParadigm` persists too.
 * Stores selections in localStorage, mirroring `debate-data-sync`'s
 * `opponentTeamProfiles.ts`/`debate-speech-writer`'s `coachMaterials.ts`
 * persistence convention.
 *
 * @module state/judgeParadigmSelections
 */

import type { JudgeParadigm } from "../judge/judge-paradigms";

export type JudgeParadigmSelection = {
  roundId: string;
  paradigm: JudgeParadigm;
};

const STORAGE_KEY = "judgeParadigmSelections";

function readAll(): JudgeParadigmSelection[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as JudgeParadigmSelection[]) : [];
  } catch {
    return [];
  }
}

function writeAll(selections: JudgeParadigmSelection[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(selections));
}

/** Lists every persisted judge-paradigm selection. */
export function listJudgeParadigmSelections(): JudgeParadigmSelection[] {
  return readAll();
}

/** Looks up the persisted judge-paradigm selection for a round, if any. */
export function getJudgeParadigmSelection(roundId: string): JudgeParadigmSelection | undefined {
  return readAll().find((selection) => selection.roundId === roundId);
}

/** Saves a round's judge-paradigm selection, overwriting any existing selection for that `roundId`. */
export function saveJudgeParadigmSelection(selection: JudgeParadigmSelection): void {
  const selections = readAll();
  const index = selections.findIndex((existing) => existing.roundId === selection.roundId);
  if (index === -1) {
    selections.push(selection);
  } else {
    selections[index] = selection;
  }
  writeAll(selections);
}

/** Deletes a round's persisted judge-paradigm selection; a no-op if it isn't stored. */
export function deleteJudgeParadigmSelection(roundId: string): void {
  writeAll(readAll().filter((selection) => selection.roundId !== roundId));
}

/**
 * Every persisted judge-paradigm selection, sorted by `roundId` for a
 * stable display order — the "(b) a paradigm-picker UI ... that
 * reads/writes through the persistence store" follow-up named under idea #5
 * ("AI Judge Decision Modes") in TODO.md's Product Feature Ideas list. Used
 * by `panels/JudgeParadigmPickerPanel.tsx`.
 */
export function buildJudgeParadigmSelectionsPanelView(): JudgeParadigmSelection[] {
  return [...listJudgeParadigmSelections()].sort((a, b) => a.roundId.localeCompare(b.roundId));
}

/**
 * Builds the `debate-round` AI Judge Decision page's deep link for a round
 * that already has a saved paradigm here — closes the
 * `docs/features/judge-paradigm-selections.md` Known gap that this panel
 * "doesn't itself invoke a judge decision": `JudgeParadigmPickerPanel.tsx`
 * renders this as a link next to each saved selection, and
 * `JudgeDecisionPanel.tsx` (`debate-round`) reads the same `roundId` query
 * param via `next/navigation`'s `useSearchParams` to pre-fill its form,
 * mirroring `debate-card-search`'s `buildReuseCheckDeepLink`/`?checkUrl=`
 * convention. Kept here (rather than in `debate-round`, which already
 * depends on this package for `getJudgeParadigmSelection`) so the link
 * shape lives beside the data it points at.
 */
export function buildJudgeDecisionDeepLink(roundId: string): string {
  return `/judge-decision?roundId=${encodeURIComponent(roundId)}`;
}
