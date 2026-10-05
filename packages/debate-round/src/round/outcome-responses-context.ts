/**
 * @fileoverview Gathers the round so far into the input for the timer
 * menu's "AI outcome responses": which speeches came before the one being
 * prepared, the text of each (cards included), the flow grid, and the most
 * likely judge. Prompt text and parsing live in `debate-speech-writer`'s
 * `prompts/speech-outcome-responses.ts`; the network call and linked-doc
 * fetching live in `outcome-responses-client.ts`. Everything here is pure.
 *
 * @module round/outcome-responses-context
 */

import type { JudgeProfile } from "@debate/speech-writer/src/judge/judge-profile";
import { buildJudgeTendencySummary } from "@debate/speech-writer/src/judge/judge-profile";
import { getJudgeParadigm, judgeParadigms } from "@debate/speech-writer/src/judge/judge-paradigms";
import type {
  OutcomeJudge,
  OutcomeSide,
} from "@debate/speech-writer/src/prompts/speech-outcome-responses";
import type { Flow, Round } from "../types/flow";
import { getFlowRowSummaries } from "../flow/flow-transcript-summary";
import { getSpeechSideKey } from "../flow/argument-tree";

/** Which side gives `speech`: `"1AC"`, `"2AR"`, `"AC"` are aff; `"1NC"`, `"NR"` are neg. */
export function getOutcomeSpeechSide(speech: string): OutcomeSide | null {
  const key = getSpeechSideKey(speech.trim());
  if (key === "A") return "aff";
  if (key === "N") return "neg";
  return null;
}

/**
 * Speeches given before `speechName`, in column order. When the speech isn't
 * one of the flow's columns, every column counts as prior.
 */
export function getPriorSpeechNames(columns: string[], speechName: string): string[] {
  const target = speechName.trim().toUpperCase();
  const index = columns.findIndex((c) => c.trim().toUpperCase() === target);
  return index === -1 ? [...columns] : columns.slice(0, index);
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };

/**
 * Speech doc HTML or markdown to plain text the model can read. Highlighted
 * (`<mark>`) text, the words actually read aloud from a card, is kept as
 * `==text==` so the model can tell it from unread card text.
 */
export function speechDocToText(doc: string): string {
  if (!doc) return "";
  return doc
    .replace(/<mark\b[^>]*>([\s\S]*?)<\/mark>/gi, "==$1==")
    .replace(/<(br|\/p|\/h[1-6]|\/li|\/div)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name: string) => ENTITIES[name] ?? "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

const MAX_FLOW_CELL_CHARS = 400;

function clip(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > MAX_FLOW_CELL_CHARS ? `${trimmed.slice(0, MAX_FLOW_CELL_CHARS)}…` : trimmed;
}

/**
 * Every flow of the round as text: one block per flow sheet, one line per
 * argument row with each speech's entry on it, and unanswered rows flagged.
 */
export function buildRoundFlowText(flows: Pick<Flow, "content" | "children" | "columns">[]): string {
  const blocks = flows
    .map((flow) => {
      const rows = getFlowRowSummaries(flow).filter((row) => !row.isHeading);
      if (rows.length === 0) return "";
      const lines = rows.map((row) => {
        const entries = row.entries.map((e) => `${e.speech}: ${clip(e.content)}`).join(" | ");
        return `- ${entries}${row.isUnanswered ? ` (unanswered since ${row.lastSpeech})` : ""}`;
      });
      return `## ${flow.content?.trim() || "Flow"}\n${lines.join("\n")}`;
    })
    .filter(Boolean);
  return blocks.length > 0 ? blocks.join("\n\n") : "No arguments have been flowed yet.";
}

/** The flows that belong to the same round as `flow` (just `flow` when it has none). */
export function getRoundFlows(flow: Flow, flows: Flow[]): Flow[] {
  if (flow.roundId == null) return [flow];
  const roundFlows = flows.filter((f) => f.roundId === flow.roundId && !f.archived);
  return roundFlows.some((f) => f.id === flow.id) ? roundFlows : [flow, ...roundFlows];
}

/** The round label shown to the model, e.g. "Glenbrooks, Octos: Lynbrook BZ vs Monta Vista EY". */
export function buildOutcomeRoundLabel(round: Round | undefined): string | undefined {
  if (!round) return undefined;
  if (round.title?.trim()) return round.title.trim();
  const aff = round.schools?.aff[0] || "Aff";
  const neg = round.schools?.neg[0] || "Neg";
  return [round.tournamentName, round.roundLevel].filter(Boolean).join(", ") + `: ${aff} vs ${neg}`;
}

/** Paradigm used when nothing on record says how the judge votes. */
export const DEFAULT_OUTCOME_PARADIGM_ID = "flow" as const;

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Picks the judge the simulation predicts for. A round judge with a saved
 * profile wins, preferring the one with the most ballots on record, and
 * votes under that profile's most-tagged paradigm. With no matching
 * profile, the round's first judge (or a typical judge) votes under the
 * paradigm most common across all saved profiles, else a flow judge.
 */
export function pickLikelyOutcomeJudge(judgeNames: string[], profiles: JudgeProfile[]): OutcomeJudge {
  const byName = new Map(profiles.map((p) => [normalizeName(p.judgeId), p]));
  const matched = judgeNames
    .map((name) => byName.get(normalizeName(name)))
    .filter((p): p is JudgeProfile => p !== undefined)
    .sort((a, b) => b.roundsJudged - a.roundsJudged);

  const profile = matched[0];
  if (profile) {
    const paradigm =
      (profile.mostCommonParadigm && getJudgeParadigm(profile.mostCommonParadigm)) ||
      judgeParadigms[DEFAULT_OUTCOME_PARADIGM_ID];
    return { name: profile.judgeId, paradigm, tendencySummary: buildJudgeTendencySummary(profile) };
  }

  const counts = new Map<string, number>();
  for (const p of profiles) {
    if (p.mostCommonParadigm) counts.set(p.mostCommonParadigm, (counts.get(p.mostCommonParadigm) ?? 0) + 1);
  }
  const common = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const paradigm = (common && getJudgeParadigm(common)) || judgeParadigms[DEFAULT_OUTCOME_PARADIGM_ID];
  const name = judgeNames.find((n) => n.trim())?.trim() ?? "Typical judge";
  return { name, paradigm };
}

/**
 * The highlighted (`<mark>`) passages of a search result's card markup,
 * joined with ellipses: the part of the card that gets read aloud.
 */
export function extractHighlightedText(html: string): string {
  const marks = [...html.matchAll(/<mark\b[^>]*>([\s\S]*?)<\/mark>/gi)]
    .map((m) => speechDocToText(m[1]))
    .filter(Boolean);
  return marks.join(" … ");
}
