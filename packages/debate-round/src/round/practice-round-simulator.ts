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
 */

import type { Flow } from "debate-core/src/types/flow";
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
  OpponentPersona,
} from "debate-speech-writer/src/opponent/opponent-personas";
import {
  buildOpponentPersonaPrompt,
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
};

export type PracticeRoundSetup = {
  speechOrder: AiVersusSpeechSlot[];
  judgeParadigm: JudgeParadigm;
  opponentPersona: OpponentPersona | null;
  sections: PracticeRoundSection[];
};

/**
 * Composes a practice round's setup — the format's speech order tagged by
 * who speaks each slot (reusing idea #3's `buildAiVersusSpeechOrder`), the
 * selected judge paradigm's prompt section, and the selected AI opponent
 * persona's prompt section (if any) — into one renderable document. Throws
 * if a paradigm/persona id is given that isn't a known built-in.
 */
export function buildPracticeRoundSetup(input: PracticeRoundSetupInput): PracticeRoundSetup {
  const speechOrder = buildAiVersusSpeechOrder(input.styleKey, input.userSide ?? "primary");
  const judgeParadigm = resolveJudgeParadigm(input.judgeParadigm);
  const opponentPersona = resolveOpponentPersona(input.opponentPersona);

  const sections: PracticeRoundSection[] = [
    { title: "Speech order", body: formatSpeechOrderSection(speechOrder) },
    { title: "Judge paradigm", body: buildJudgeParadigmPrompt(judgeParadigm) },
    {
      title: "AI opponent",
      body: opponentPersona
        ? buildOpponentPersonaPrompt(opponentPersona)
        : "No AI opponent persona selected — the AI will argue with no persona-specific style guidance.",
    },
  ];

  return { speechOrder, judgeParadigm, opponentPersona, sections };
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

/**
 * Composes post-round feedback for a practice round: a line framing the
 * decision around the paradigm the round was judged under (its voting
 * priorities, or its description when it has none — e.g. a custom
 * paradigm), followed by the existing AI Coach Mode coaching session
 * (`flow/coach-mode.ts`'s `buildCoachingSession`) for the caller's side.
 * Reuses `coach-mode.ts` directly rather than reimplementing any of its
 * flow-vulnerability logic.
 */
export function buildPracticeRoundFeedback(
  flow: Pick<Flow, "children" | "columns">,
  sideKey: string,
  judgeParadigm: JudgeParadigm,
  options: { collapseLimit?: number } = {},
): PracticeRoundFeedback {
  const coachingPrompts = buildCoachingSession(flow, sideKey, options);

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

  return { judgeParadigm, coachingPrompts, sections };
}

/** Renders a `PracticeRoundFeedback` as a single markdown-ish text document, suitable for a post-round feedback panel. */
export function buildPracticeRoundFeedbackText(feedback: PracticeRoundFeedback): string {
  return feedback.sections.map((section) => `### ${section.title}\n${section.body}`).join("\n\n");
}
