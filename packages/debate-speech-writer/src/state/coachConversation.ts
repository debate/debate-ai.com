/**
 * @fileoverview Persistent storage for a team's "Ask the coach" conversation
 * history (`CoachConversationTurn`s) — closes the "No conversation
 * history — each question is answered independently; a prior
 * question/answer isn't persisted or fed back into a later one" Known gap
 * recorded in `docs/features/coach-materials.md` for idea #8
 * ("Video-Lecture-Training Coach AI") in TODO.md. Stores turns in
 * localStorage, mirroring `coachMaterials.ts`'s persistence convention.
 *
 * @module state/coachConversation
 */

import type { CoachConversationTurn } from "../coach/team-coach-materials";


import {
  mirrorToolRecordSave,
  mirrorToolRecordsClear,
} from "debate-data-sync/src/state/tool-record-mirror";
const STORAGE_KEY = "coachConversation";

/**
 * Caps how many turns are kept in storage — an unbounded conversation would
 * grow localStorage without limit; the most recent turns are what matter for
 * both display and (via `buildCoachConversationMessages`'s own, smaller
 * `maxHistoryTurns` window) AI context anyway.
 */
const MAX_STORED_TURNS = 50;

function readAll(): CoachConversationTurn[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CoachConversationTurn[]) : [];
  } catch {
    return [];
  }
}

function writeAll(turns: CoachConversationTurn[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(turns));
}

function generateTurnId(): string {
  return `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Lists every persisted conversation turn, oldest first. */
export function listCoachConversationTurns(): CoachConversationTurn[] {
  return readAll();
}

/**
 * Records a new question/answer turn, stamping it with a fresh id and the
 * current time, and returns the saved turn. Trims the stored history down
 * to the most recent `MAX_STORED_TURNS` turns.
 */
export function appendCoachConversationTurn(input: {
  question: string;
  answer: string;
}): CoachConversationTurn {
  const turn: CoachConversationTurn = {
    id: generateTurnId(),
    question: input.question,
    answer: input.answer,
    askedAt: Date.now(),
  };

  const turns = [...readAll(), turn].slice(-MAX_STORED_TURNS);
  writeAll(turns);
  // Only the new turn is pushed up: trimming past `MAX_STORED_TURNS` drops
  // turns from *this browser's* copy, and an older device's history is not
  // something a newer one's cap should delete from the account.
  mirrorToolRecordSave("coachConversation", turn);
  return turn;
}

/** Clears the entire persisted conversation history. */
export function clearCoachConversationHistory(): void {
  writeAll([]);
  mirrorToolRecordsClear("coachConversation");
}
