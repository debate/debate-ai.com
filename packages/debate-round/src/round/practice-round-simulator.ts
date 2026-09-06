/**
 * @fileoverview Practice round simulator setup/feedback composition — pure
 * data-composition helpers for the "Practice Round Simulator" bullet in
 * TODO.md's Research Crowdsourcing Organizer Features ("Recreate a
 * tournament round with timer, speeches, judge persona, and post-round
 * feedback."). Combines the existing idea #3 speech-order builder
 * (`ai-versus-speech-order.ts`), `debate-speech-writer`'s judge-paradigm and
 * opponent-persona registries, and the existing AI Coach Mode coaching
 * session (`flow/coach-mode.ts`) into one structured practice-round setup
 * and post-round feedback report, reusing each directly rather than
 * reimplementing any of that logic. This is the first slice only — it
 * doesn't call any AI model to actually generate the AI opponent's speeches
 * or a judge decision, isn't wired into any round-simulator UI, and doesn't
 * persist a practice round anywhere; see the follow-ups noted in TODO.md.
 *
 * `opponentDifficulty` closes the "🤖 AI Practice Opponent" idea's "extend
 * the Practice Round Simulator's own separate persona setup to carry a
 * difficulty too" Next item (TODO.md's Research Crowdsourcing Organizer
 * Features list): the same `opponentDifficulties` axis
 * `OpponentPersonaPickerPanel`/`AiVersusRoundPanel` already carry, layered
 * onto this setup's own persona choice via `buildOpponentPersonaPrompt`'s
 * existing `difficulty` parameter.
 *
 * `buildPracticeRoundFeedback`'s optional `opponentPersona` option closes
 * that same idea's "post-round feedback tips specific to the persona faced"
 * Next item: when the round's setup carried an AI opponent persona, feedback
 * gets an extra section built from `opponent-personas.ts`'s new
 * `buildOpponentPersonaFeedbackTips`, naming what to prep before facing that
 * style again.
 */

import type { Flow } from "../types/flow";
import type {
  BuiltinJudgeParadigmId,
  JudgeParadigm,
} from "debate-speech-writer/src/judge/judge-paradigms";
import {
  buildJudgeParadigmPrompt,
  getJudgeParadigm,
  judgeParadigms,
} from "debate-speech-writer/src/judge/judge-paradigms";
import type {
  BuiltinOpponentPersonaId,
  OpponentDifficulty,
  OpponentPersona,
} from "debate-speech-writer/src/opponent/opponent-personas";
import {
  buildOpponentPersonaFeedbackTips,
  buildOpponentPersonaPrompt,
  DEFAULT_OPPONENT_DIFFICULTY,
  getOpponentPersona,
} from "debate-speech-writer/src/opponent/opponent-personas";
import type { DebateStyleKey } from "debate-timer/src/formats/debate-format-times";
import type { CoachingPrompt } from "../flow/coach-mode";
import { buildCoachingSession, buildCoachingSummaryText } from "../flow/coach-mode";
import type { AiVersusSide, AiVersusSpeechSlot } from "./ai-versus-speech-order";
import { buildAiVersusSpeechOrder } from "./ai-versus-speech-order";

/** One labeled section of a rendered setup or feedback document. */
export type PracticeRoundSection = { title: string; body: string };

function resolveJudgeParadigm(
  judgeParadigm?: JudgeParadigm | BuiltinJudgeParadigmId,
): JudgeParadigm {
  if (!judgeParadigm) return judgeParadigms.flow;
  if (typeof judgeParadigm !== "string") return judgeParadigm;

  const resolved = getJudgeParadigm(judgeParadigm);
  if (!resolved) {
    throw new Error(`buildPracticeRoundSetup: unknown judge paradigm id "${judgeParadigm}"`);
  }
  return resolved;
}

function resolveOpponentPersona(
  opponentPersona?: OpponentPersona | BuiltinOpponentPersonaId,
): OpponentPersona | null {
  if (!opponentPersona) return null;
  if (typeof opponentPersona !== "string") return opponentPersona;

  const resolved = getOpponentPersona(opponentPersona);
  if (!resolved) {
    throw new Error(`buildPracticeRoundSetup: unknown opponent persona id "${opponentPersona}"`);
  }
  return resolved;
}

function formatSpeechOrderSection(order: AiVersusSpeechSlot[]): string {
  if (order.length === 0) return "No speeches scheduled for this format.";
  return order
    .map(
      (slot) =>
        `${slot.index + 1}. ${slot.name} (${slot.speaker === "user" ? "you" : "AI"}, ${slot.time}s)`,
    )
    .join("\n");
}

export type PracticeRoundSetupInput = {
  styleKey: DebateStyleKey;
  /** Which side the human user picked. Defaults to `"primary"`. */
  userSide?: AiVersusSide;
  /** A built-in paradigm id, or a pre-built paradigm (e.g. from `buildCustomJudgeParadigm`). Defaults to the "flow" paradigm. */
  judgeParadigm?: JudgeParadigm | BuiltinJudgeParadigmId;
  /** A built-in persona id, or a pre-built persona. Omit for no AI opponent style guidance. */
  opponentPersona?: OpponentPersona | BuiltinOpponentPersonaId;
  /** How strong the AI opponent should argue within its persona. Defaults to `DEFAULT_OPPONENT_DIFFICULTY`. Only meaningful when `opponentPersona` is set. */
  opponentDifficulty?: OpponentDifficulty;
};

export type PracticeRoundSetup = {
  speechOrder: AiVersusSpeechSlot[];
  judgeParadigm: JudgeParadigm;
  opponentPersona: OpponentPersona | null;
  opponentDifficulty: OpponentDifficulty;
  sections: PracticeRoundSection[];
};

/**
 * Composes a practice round's setup — the format's speech order tagged by
 * who speaks each slot (reusing idea #3's `buildAiVersusSpeechOrder`), the
 * selected judge paradigm's prompt section, and the selected AI opponent
 * persona's prompt section at the selected difficulty (if any) — into one
 * renderable document. Throws if a paradigm/persona id is given that isn't a
 * known built-in.
 */
export function buildPracticeRoundSetup(input: PracticeRoundSetupInput): PracticeRoundSetup {
  const speechOrder = buildAiVersusSpeechOrder(input.styleKey, input.userSide ?? "primary");
  const judgeParadigm = resolveJudgeParadigm(input.judgeParadigm);
  const opponentPersona = resolveOpponentPersona(input.opponentPersona);
  const opponentDifficulty = input.opponentDifficulty ?? DEFAULT_OPPONENT_DIFFICULTY;

  const sections: PracticeRoundSection[] = [
    { title: "Speech order", body: formatSpeechOrderSection(speechOrder) },
    { title: "Judge paradigm", body: buildJudgeParadigmPrompt(judgeParadigm) },
    {
      title: "AI opponent",
      body: opponentPersona
        ? buildOpponentPersonaPrompt(opponentPersona, opponentDifficulty)
        : "No AI opponent persona selected — the AI will argue with no persona-specific style guidance.",
    },
  ];

  return { speechOrder, judgeParadigm, opponentPersona, opponentDifficulty, sections };
}

/** Renders a `PracticeRoundSetup` as a single markdown-ish text document, suitable for a round-setup screen. */
export function buildPracticeRoundSetupText(setup: PracticeRoundSetup): string {
  return setup.sections.map((section) => `### ${section.title}\n${section.body}`).join("\n\n");
}

export type PracticeRoundFeedback = {
  judgeParadigm: JudgeParadigm;
  coachingPrompts: CoachingPrompt[];
  sections: PracticeRoundSection[];
};

export type BuildPracticeRoundFeedbackOptions = {
  collapseLimit?: number;
  /**
   * The AI opponent persona this round's setup faced, if any. When given,
   * feedback gets an extra "Facing … again" section listing
   * `buildOpponentPersonaFeedbackTips`' prep tips for that persona. Omitted
   * (or `null`, matching `PracticeRoundSetup.opponentPersona`) when the round
   * had no AI opponent persona, or for a caller (e.g. this file's own
   * existing tests) that doesn't care about persona-specific tips.
   */
  opponentPersona?: OpponentPersona | null;
};

/**
 * Composes post-round feedback for a practice round: a line framing the
 * decision around the paradigm the round was judged under (its voting
 * priorities, or its description when it has none — e.g. a custom
 * paradigm), followed by the existing AI Coach Mode coaching session
 * (`flow/coach-mode.ts`'s `buildCoachingSession`) for the caller's side, and
 * — when `options.opponentPersona` is given — a persona-specific prep-tips
 * section. Reuses `coach-mode.ts` directly rather than reimplementing any of
 * its flow-vulnerability logic.
 */
export function buildPracticeRoundFeedback(
  flow: Pick<Flow, "children" | "columns">,
  sideKey: string,
  judgeParadigm: JudgeParadigm,
  options: BuildPracticeRoundFeedbackOptions = {},
): PracticeRoundFeedback {
  const { opponentPersona, ...coachingOptions } = options;
  const coachingPrompts = buildCoachingSession(flow, sideKey, coachingOptions);

  const sections: PracticeRoundSection[] = [
    {
      title: `Judged under: ${judgeParadigm.name}`,
      body:
        judgeParadigm.votingPriorities.length > 0
          ? `Voting priorities: ${judgeParadigm.votingPriorities.join("; ")}.`
          : judgeParadigm.description,
    },
    { title: "Coaching feedback", body: buildCoachingSummaryText(coachingPrompts) },
  ];

  if (opponentPersona) {
    sections.push({
      title: `Facing the ${opponentPersona.name} persona again`,
      body: buildOpponentPersonaFeedbackTips(opponentPersona)
        .map((tip, index) => `${index + 1}. ${tip}`)
        .join("\n"),
    });
  }

  return { judgeParadigm, coachingPrompts, sections };
}

/** Renders a `PracticeRoundFeedback` as a single markdown-ish text document, suitable for a post-round feedback panel. */
export function buildPracticeRoundFeedbackText(feedback: PracticeRoundFeedback): string {
  return feedback.sections.map((section) => `### ${section.title}\n${section.body}`).join("\n\n");
}
