/**
 * @fileoverview Configurable AI judge personas ("paradigms") for evaluating a
 * practice round. `judgeDecisionPrompt` (../prompts/judge-decision-options)
 * asks a single AI call to rotate through several paradigms in one pass;
 * this module gives each paradigm a structured, independently selectable
 * definition instead, plus support for a "custom" paradigm built from a real
 * judge's publicly stated preferences (a paradigm card).
 */

export type BuiltinJudgeParadigmId =
  | "flow"
  | "lay"
  | "policymaker"
  | "critic"
  | "educator"
  | "truth-tester";

export type JudgeParadigmId = BuiltinJudgeParadigmId | "custom";

export type JudgeParadigm = {
  id: JudgeParadigmId;
  name: string;
  description: string;
  /** Ordered highest to lowest priority when the paradigm resolves the round. */
  votingPriorities: string[];
  speedTolerance: "low" | "medium" | "high";
  jargonTolerance: "low" | "medium" | "high";
  /** Imperative instructions meant to be injected into an AI judge-decision prompt. */
  instructions: string;
};

export const judgeParadigms: Record<BuiltinJudgeParadigmId, JudgeParadigm> = {
  flow: {
    id: "flow",
    name: "Flow / Tech Judge",
    description:
      "Judges strictly off the flow: evaluates only what was said and extended in the round, weighing dropped arguments as conceded rather than importing outside opinion.",
    votingPriorities: [
      "Dropped or conceded arguments",
      "Argument interaction and clash",
      "Impact calculus (magnitude, probability, timeframe)",
      "Framework/weighing mechanism established in-round",
    ],
    speedTolerance: "high",
    jargonTolerance: "high",
    instructions:
      "Vote strictly off the flow. Do not import outside knowledge or personal opinion. Treat any argument the opposing team failed to answer as true for the round, and resolve clash using the weighing mechanisms the debaters themselves established.",
  },
  lay: {
    id: "lay",
    name: "Lay / Community Judge",
    description:
      "A parent or community judge without formal debate background. Rewards clear, persuasive, jargon-free communication over technical argumentation.",
    votingPriorities: [
      "Overall persuasiveness and clarity",
      "Real-world impact and common sense",
      "Speaking style, confidence, and organization",
      "Unclear or overly aggressive delivery counts against a team",
    ],
    speedTolerance: "low",
    jargonTolerance: "low",
    instructions:
      "Ignore debate jargon and technical theory arguments unless they are explained in plain language. Prioritize the team that is easiest to follow and most persuasive to an educated non-debater. Penalize speed or unclear delivery.",
  },
  policymaker: {
    id: "policymaker",
    name: "Policymaker",
    description:
      "Weighs the round like a policy analyst: compares the desirability of the plan and counterplans against the status quo using cost-benefit and risk analysis.",
    votingPriorities: [
      "Net benefits of plan vs. counterplan vs. status quo",
      "Solvency and feasibility",
      "Magnitude and probability of advantages/disadvantages",
      "Topicality/theory, only when it affects fair, predictable ground",
    ],
    speedTolerance: "medium",
    jargonTolerance: "medium",
    instructions:
      "Compare competing policy options on net benefits: whichever advocacy produces the best real-world outcome after solvency and risk are weighed wins the round. Give theory and topicality lower priority unless a team wins it controls the ballot.",
  },
  critic: {
    id: "critic",
    name: "Kritikal Judge",
    description:
      "Evaluates the round through a critical lens, prioritizing the framework and representations debaters establish over traditional policy impact calculus.",
    votingPriorities: [
      "Which framework for evaluating the round wins",
      "Representations, discourse, and methodology",
      "Links and impacts read through the winning framework",
      "Traditional case impacts, evaluated only within the winning framework",
    ],
    speedTolerance: "medium",
    jargonTolerance: "high",
    instructions:
      "Resolve the framework debate first: whichever team wins how the round should be evaluated determines which impacts and links matter. Do not default to policy impact calculus unless no framework argument is won clearly.",
  },
  educator: {
    id: "educator",
    name: "Educational / Developmental Judge",
    description:
      "A coach or teacher prioritizing debater growth: rewards sound argumentation and skill development over technical tricks, with an eye toward detailed post-round feedback.",
    votingPriorities: [
      "Argument quality and evidence use over speed or tricks",
      "Clash and direct engagement with the opponent's strongest arguments",
      "Constructive, skill-building delivery choices",
      "Sportsmanship and round conduct",
    ],
    speedTolerance: "medium",
    jargonTolerance: "medium",
    instructions:
      "Reward debaters for engaging directly with their opponents' best arguments rather than for technical tricks or unanswerable speed. Provide substantive reasoning a debater could use to improve, and treat the decision as a teaching moment.",
  },
  "truth-tester": {
    id: "truth-tester",
    name: "Truth Over Tech",
    description:
      "Weighs argument truth over technical drops: an unanswered argument that is not actually true or logically sound does not win the round just because it went unanswered.",
    votingPriorities: [
      "Logical soundness and truth of an argument",
      "Evidence quality and warrant strength",
      "Argument interaction, but only among arguments judged plausible",
      "Technical drops are discounted if the dropped argument is not credible",
    ],
    speedTolerance: "medium",
    jargonTolerance: "medium",
    instructions:
      "Do not treat an unanswered argument as automatically true. Independently assess whether each argument is logically sound and well-warranted before letting it factor into the decision, even if the opponent failed to respond to it.",
  },
};

export const judgeParadigmIds = Object.keys(judgeParadigms) as BuiltinJudgeParadigmId[];

export function isBuiltinJudgeParadigmId(id: string): id is BuiltinJudgeParadigmId {
  return Object.prototype.hasOwnProperty.call(judgeParadigms, id);
}

/** Looks up a built-in paradigm by id, or `null` if `id` isn't a known built-in. */
export function getJudgeParadigm(id: string): JudgeParadigm | null {
  return isBuiltinJudgeParadigmId(id) ? judgeParadigms[id] : null;
}

/** All built-in paradigms, in a stable order — for a paradigm-picker UI. */
export function listJudgeParadigms(): JudgeParadigm[] {
  return judgeParadigmIds.map((id) => judgeParadigms[id]);
}

const MAX_CUSTOM_NAME_LENGTH = 80;
const MAX_CUSTOM_NOTES_LENGTH = 2000;

export type CustomJudgeParadigmInput = {
  /** Judge's name or how they'd like the paradigm labeled, e.g. "Judge Smith". */
  name: string;
  /** The judge's own publicly stated preferences/paradigm card text. */
  notes: string;
};

/** Strips ASCII control characters (keeping tab/newline/carriage-return),
 *  then trims and clamps length for user-supplied text. */
function sanitizeText(raw: string, maxLength: number): string {
  let stripped = "";
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    const isControl = code < 0x20 || code === 0x7f;
    const isAllowedWhitespace = code === 9 || code === 10 || code === 13;
    if (!isControl || isAllowedWhitespace) stripped += ch;
  }
  stripped = stripped.trim();
  return stripped.length > maxLength ? stripped.slice(0, maxLength).trim() : stripped;
}

/**
 * Builds a "custom" judge paradigm from a real judge's publicly provided
 * preferences (e.g. text copied from a paradigm card). Unlike the built-in
 * paradigms, voting priorities aren't structured — the judge's notes are
 * carried verbatim (sanitized) into `instructions` for the AI prompt to use.
 *
 * Throws if `name` or `notes` is empty after sanitization, since a custom
 * paradigm with no actual preferences isn't meaningful.
 */
export function buildCustomJudgeParadigm(input: CustomJudgeParadigmInput): JudgeParadigm {
  const name = sanitizeText(input.name, MAX_CUSTOM_NAME_LENGTH);
  const notes = sanitizeText(input.notes, MAX_CUSTOM_NOTES_LENGTH);

  if (!name) throw new Error("buildCustomJudgeParadigm: name is required");
  if (!notes) throw new Error("buildCustomJudgeParadigm: notes are required");

  return {
    id: "custom",
    name: `Custom: ${name}`,
    description: `A custom paradigm built from ${name}'s own publicly stated judging preferences.`,
    votingPriorities: [],
    speedTolerance: "medium",
    jargonTolerance: "medium",
    instructions: notes,
  };
}

/**
 * Composes a self-contained prompt section describing how to judge the round
 * under the given paradigm, suitable for inserting into an AI judge-decision
 * prompt (see ../prompts/judge-decision-options).
 */
export function buildJudgeParadigmPrompt(paradigm: JudgeParadigm): string {
  const lines = [`Judge Paradigm: ${paradigm.name}`, paradigm.description];

  if (paradigm.votingPriorities.length > 0) {
    lines.push(
      "",
      "Voting priorities (highest to lowest):",
      ...paradigm.votingPriorities.map((priority, index) => `${index + 1}. ${priority}`),
    );
  }

  lines.push(
    "",
    `Speed tolerance: ${paradigm.speedTolerance}. Jargon tolerance: ${paradigm.jargonTolerance}.`,
    "",
    paradigm.instructions,
  );

  return lines.join("\n");
}
