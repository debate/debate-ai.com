/**
 * @fileoverview Turns a round from the judge's round workspace
 * (`@debate-ai/round`'s `Round` and its `Flow`s) into the body of
 * `POST /api/rebuttal-redos`: the debaters by seat, the format guessed from
 * the flow's columns, and what each rebuttal said.
 *
 * @module debate-practice-rounds/rebuttal-redos/round-input
 */

import { seatLabel } from "./prompts";
import { extractSpeechText, inferRedoFormat, redoSeats, type RedoFlow } from "./rules";
import { MAX_SPEECH_SOURCE, type NewRedoRound, type RedoRoundDebater, type RedoSide } from "./types";

/** The slice of a workspace `Round` this reads. */
export interface RedoSourceRound {
  id: number | string;
  title?: string;
  tournamentName?: string;
  roundLevel?: string;
  debaters: { aff: readonly string[]; neg: readonly string[] };
  judges?: readonly string[];
  flowIds?: readonly number[];
  winner?: RedoSide;
}

/** The slice of a workspace `Flow` this reads. */
export interface RedoSourceFlow extends RedoFlow {
  id: number;
  roundId?: number;
  archived?: boolean;
  winner?: "aff" | "neg" | "undecided";
}

/** Whether `email` is one of the round's judges (case-insensitive). */
export function isRoundJudge(round: Pick<RedoSourceRound, "judges">, email: string | null | undefined): boolean {
  const key = email?.trim().toLowerCase();
  if (!key) return false;
  return (round.judges ?? []).some((judge) => judge.trim().toLowerCase() === key);
}

/** The round's flows: those it lists, plus any flow pointing back at it. */
export function flowsForRound<F extends RedoSourceFlow>(round: RedoSourceRound, flows: readonly F[]): F[] {
  const ids = new Set(round.flowIds ?? []);
  return flows.filter((flow) => !flow.archived && (ids.has(flow.id) || String(flow.roundId ?? "") === String(round.id)));
}

/** The round's display title. */
export function redoRoundTitle(round: RedoSourceRound): string {
  if (round.title?.trim()) return round.title.trim();
  return [round.tournamentName, round.roundLevel].map((part) => part?.trim()).filter(Boolean).join(" — ") || "Untitled round";
}

/** Builds the generate body for one round and its flows. */
export function buildRedoRound(round: RedoSourceRound, flows: readonly RedoSourceFlow[], judgeNotes = ""): NewRedoRound {
  const roundFlows = flowsForRound(round, flows);
  const format = inferRedoFormat(roundFlows.flatMap((flow) => flow.columns));
  const debaters: RedoRoundDebater[] = [];
  for (const side of ["aff", "neg"] as const) {
    (round.debaters?.[side] ?? []).slice(0, 2).forEach((email, index) => {
      if (email?.trim()) debaters.push({ email: email.trim(), side, position: index === 0 ? 0 : 1 });
    });
  }
  const speeches: Record<string, string> = {};
  for (const seat of redoSeats(format, debaters)) {
    const text = extractSpeechText(roundFlows, seat.speech, MAX_SPEECH_SOURCE);
    if (text) speeches[seatLabel(seat)] = text;
  }
  const flowWinner = roundFlows.find((flow) => flow.winner === "aff" || flow.winner === "neg")?.winner as RedoSide | undefined;
  return {
    roundId: String(round.id),
    roundTitle: redoRoundTitle(round),
    format,
    winner: round.winner ?? flowWinner ?? null,
    debaters,
    speeches,
    judgeNotes,
  };
}
