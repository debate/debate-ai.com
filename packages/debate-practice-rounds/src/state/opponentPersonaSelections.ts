/**
 * @fileoverview Persistent storage for a practice session's selected
 * `OpponentPersona`, keyed by `sessionId` — the "(c) persisting the selected
 * persona per practice session" follow-up named in the "AI Practice
 * Opponent" slice (`opponent/opponent-personas.ts`) in TODO.md's Product
 * Feature Ideas list. Stores the full `OpponentPersona` (rather than just a
 * builtin id) so a future custom persona would persist too, mirroring the
 * existing `judgeParadigmSelections.ts`/`coachMaterials.ts` persistence
 * convention (SSR/no-storage-safe, corrupt or missing JSON degrades to an
 * empty list rather than throwing).
 *
 * `difficulty` is optional and closes the "a difficulty slider layered on
 * top of persona choice" Next item named under the "🤖 AI Practice
 * Opponent" idea in TODO.md — a second, independent axis alongside
 * `persona`. Left unset it resolves to `DEFAULT_OPPONENT_DIFFICULTY`
 * ("intermediate") wherever it's read, so every selection saved before this
 * field existed keeps behaving exactly as it did.
 *
 * @module state/opponentPersonaSelections
 */

import type { OpponentDifficulty, OpponentPersona } from "debate-speech-writer/src/opponent/opponent-personas";

export type OpponentPersonaSelection = {
  sessionId: string;
  persona: OpponentPersona;
  difficulty?: OpponentDifficulty;
};

const STORAGE_KEY = "opponentPersonaSelections";

function readAll(): OpponentPersonaSelection[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OpponentPersonaSelection[]) : [];
  } catch {
    return [];
  }
}

function writeAll(selections: OpponentPersonaSelection[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(selections));
}

/** Lists every persisted opponent-persona selection. */
export function listOpponentPersonaSelections(): OpponentPersonaSelection[] {
  return readAll();
}

/** Looks up the persisted opponent-persona selection for a practice session, if any. */
export function getOpponentPersonaSelection(sessionId: string): OpponentPersonaSelection | undefined {
  return readAll().find((selection) => selection.sessionId === sessionId);
}

/** Saves a practice session's opponent-persona selection, overwriting any existing selection for that `sessionId`. */
export function saveOpponentPersonaSelection(selection: OpponentPersonaSelection): void {
  const selections = readAll();
  const index = selections.findIndex((existing) => existing.sessionId === selection.sessionId);
  if (index === -1) {
    selections.push(selection);
  } else {
    selections[index] = selection;
  }
  writeAll(selections);
}

/** Deletes a practice session's persisted opponent-persona selection; a no-op if it isn't stored. */
export function deleteOpponentPersonaSelection(sessionId: string): void {
  writeAll(readAll().filter((selection) => selection.sessionId !== sessionId));
}

/**
 * Every persisted opponent-persona selection, sorted by `sessionId` for a
 * stable display order — the "(b) a persona-picker UI ... that reads/writes
 * through the persistence store" follow-up named under the "AI Practice
 * Opponent" idea in TODO.md's Product Feature Ideas list. Used by
 * `panels/OpponentPersonaPickerPanel.tsx`.
 */
export function buildOpponentPersonaSelectionsPanelView(): OpponentPersonaSelection[] {
  return [...listOpponentPersonaSelections()].sort((a, b) => a.sessionId.localeCompare(b.sessionId));
}
