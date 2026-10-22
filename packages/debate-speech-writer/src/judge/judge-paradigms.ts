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

const JudgeParadigm = `
## I. Overall Philosophy

- A. My approach
  - Debate is both an argumentative competition and a communication activity.
  - I value **clash**: engage your opponents’ reasoning, defend your own, and explain why the comparison favors you.
  - I am open to traditional, policy-oriented, philosophical, critical, and performance-based approaches.
  - No argument wins simply because it belongs to a particular category. Explain its relevance, defend its warrants, and establish its implications for the ballot.

- B. What wins my ballot
  - A clear explanation of what I should evaluate.
  - Well-supported arguments that survive opposing responses.
  - Comparative weighing that tells me why your remaining arguments matter more.
  - A final speech that gives me a coherent decision rather than a list of claims that you are “winning.”

- C. My role
  - I evaluate the debate presented, not the debate I wish had occurred.
  - I will not supply missing links, invent responses, or use my outside knowledge to rescue an argument.
  - These preferences are defaults, not substitutes for tournament rules or well-developed arguments about how the round should be evaluated.

## II. Technical Debate, Truth, and Argument Quality

- A. Tech versus truth
  - I lean toward technical evaluation, but technical execution requires understandable, warranted arguments.
  - A complete argument includes a claim, a reason to believe it, and an explanation of why it matters.
  - A conceded argument receives substantial weight, but a dropped assertion does not automatically become a round-winning argument.
  - I will not reject an unfamiliar position simply because I disagree with it. Equally, I will not manufacture warrants for a position merely because nobody answered it.

- B. Drops and extensions
  - Identify what was dropped and explain the consequence.
  - Extend the substance of your argument, not just its label or author’s name.
  - Address relevant responses before treating your argument as established.
  - A concession establishes only what the original argument actually supported; it does not license a much larger claim in the final speech.

- C. Offense and defense
  - Offense supplies a reason to prefer your side; defense reduces or eliminates a reason to prefer theirs.
  - Strong defense can eliminate an impact or undermine a causal chain. I do not assume every argument retains a meaningful “risk.”
  - You may win through defensive argumentation when you establish that the other side has not met its burden.
  - Explain the applicable burden or presumption rather than assuming I will resolve it for you.

## III. Framework, Impacts, and Weighing

- A. Framework
  - Explain what the ballot should prioritize and why.
  - Consequences, rights, duties, structural violence, education, fairness, and ethical methods are all available evaluative approaches.
  - If no alternative is established in a conventional policy debate, I default to comparing the consequences of the competing options.
  - If frameworks conflict, compare them directly. Do not simply repeat that yours comes first.

- B. Impact development
  - Explain the full causal chain: what changes, how that change produces further effects, and who experiences the resulting harm or benefit.
  - Establish the importance of the impact rather than relying on a dramatic label.
  - Large impacts require credible links. Smaller, well-supported impacts can outweigh speculative catastrophes.
  - Structural and ongoing harms deserve substantive evaluation; they are not automatically secondary to extinction claims.

- C. Comparative weighing
  - Magnitude: How serious is the harm or benefit?
  - Scope: How many people or communities are affected?
  - Probability: How likely is the outcome, given the contested links?
  - Timeframe: When does it occur, and why does timing matter?
  - Duration and reversibility: How long does it last, and can it be repaired?
  - Distribution: Who bears the costs, and does that distribution have ethical significance?
  - Prerequisites: Does addressing one problem make addressing another possible?

- D. What persuasive weighing looks like
  - Explain why your chosen comparison resolves this particular debate.
  - “Our impact is bigger” is incomplete without probability and link analysis.
  - “Our impact happens first” matters only if earlier action changes the comparison.
  - If both sides use different weighing methods, explain why your method should control.

## IV. Case Debate, Disadvantages, and Counterplans

- A. Case debate
  - Engage the affirmative’s central claims, not just peripheral details.
  - Contest the existence of the problem, its causes, the proposed solution, and the claimed benefits where appropriate.
  - Affirmatives should explain how their advocacy addresses the identified harm and answer substantive objections.
  - Specific analysis is more persuasive than generic statements that could apply to any case.

- B. Disadvantages
  - Explain the relevant status quo, the link to the advocacy, the intervening causal steps, and the impact.
  - Address whether the harm would occur anyway and whether the advocacy meaningfully changes its likelihood.
  - Compare the disadvantage against the affirmative’s benefits.
  - A frightening impact cannot compensate for an unexplained link.

- C. Counterplans
  - State the counterplan text, actor, mechanism, and conditional status clearly.
  - Explain solvency, competition, and the net benefit.
  - Counterplans do not have to be physically impossible to combine with the plan, but you must explain why the proposed combination does not defeat your competitive claim.
  - Permutations should identify the combination being tested and explain its implications.
  - I do not automatically reject particular counterplan types, but I will evaluate well-developed objections to their legitimacy.
  - Do not assume I will abandon a losing counterplan and evaluate the status quo for you; request and justify that decision rule.

## V. Kritiks and Philosophical Arguments

- A. General openness
  - Kritiks are legitimate arguments, but terminology is not a substitute for explanation.
  - Assume I understand basic debate concepts, not every author or school of thought.
  - Explain the theory in plain language before relying on specialized vocabulary.

- B. What I need from a kritik
  - A thesis: What underlying practice, assumption, or relationship is being criticized?
  - A specific link: What did the opposing advocacy, evidence, method, or speech do that produces the criticism?
  - An impact: Why does that practice or assumption matter?
  - An alternative or remedy, where relevant: What should replace it, and how does that improve the situation?
  - A framework: How should this criticism interact with the opposing team’s claims?

- C. Alternatives and permutations
  - An alternative need not function like legislation, but it must have an understandable purpose and mechanism.
  - Explain what endorsing the alternative changes and what it does not.
  - If you do not need an alternative to win, explain the independent ballot implication of your criticism.
  - Answer permutations substantively rather than declaring them invalid without justification.

- D. Philosophical frameworks
  - Define important concepts and explain the reasoning connecting your premises to your conclusion.
  - Show how your ethical framework evaluates the actual arguments in the round.
  - Author names and quotations are not self-explanatory.
  - If your framework excludes ordinary impact comparison, justify that exclusion and answer objections to it.

## VI. Performance and Nontraditional Advocacy

- A. Performance as argument
  - Narrative, poetry, embodied performance, music, and other expressive forms can contribute to a persuasive advocacy.
  - Explain what the performance demonstrates, contests, or accomplishes.
  - Connect it to the opposing arguments and to the decision you want me to make.
  - I will not assume that an emotionally powerful presentation automatically establishes its competitive implications.

- B. Topic relationship and engagement
  - Explain your relationship to the resolution, including why departing from conventional advocacy is justified.
  - Give the opposing side an identifiable position or method to engage.
  - A performance does not automatically escape topicality or framework objections.
  - Conversely, calling something “not real debate” is not a sufficient response to a developed defense of that approach.

- C. Role of the ballot
  - Explain what voting for you endorses and why that endorsement matters.
  - Do not assume the ballot produces broad social change without defending that claim.
  - I can evaluate arguments about education, representation, and debate practices without treating the ballot as capable of solving every underlying problem.

## VII. Topicality, Theory, and Procedural Arguments

- A. Necessary components
  - Present a clear interpretation, violation, standards, and voting implication.
  - Explain what your proposed rule permits and excludes.
  - Identify the relevant harm to fairness, preparation, access, clash, or education.
  - Concrete examples are more persuasive than abstract declarations of abuse.

- B. Evaluation
  - I am more receptive to theory that addresses a meaningful competitive or educational problem than theory designed solely to create a surprise technical loss.
  - Actual abuse is persuasive, but a well-explained structural or predictable harm can also matter.
  - Compare interpretations and explain why yours produces a better debate.
  - If you advocate reasonability, provide a standard for what counts as reasonable.

- C. Remedies and defaults
  - Explain why the appropriate remedy is rejecting the argument, rejecting the team, or something else.
  - I generally prefer an argument-level remedy unless the violation compromises the fairness or integrity of the round.
  - Successfully answering theory does not automatically make it a reason to vote for you.
  - Disclosure, conditionality, and other contested practices require contextual argumentation; do not assume every event or circuit shares the same norms.
  - I am skeptical of hidden spikes and unwarranted “gotcha” arguments. Make their meaning and implications clear when introduced.

## VIII. Evidence, Delivery, and Round Management

- A. Evidence quality and ethics
  - Represent sources accurately and make supporting material available when required.
  - Distinguish what the author establishes from what you infer.
  - Compare methodology, expertise, recency, relevance, and context rather than merely counting cards.
  - Fabrication, material misrepresentation, and deliberate clipping are serious integrity issues, not ordinary strategic choices.
  - Raise challenges specifically and follow the tournament’s evidence procedures. I will not treat every accusation as an automatic round-ending challenge.

- B. Speed and clarity
  - Speak at a pace that preserves comprehension and meaningful participation.
  - Speed is acceptable only while the argument remains clear; faster is not inherently better.
  - Slow down for advocacy texts, interpretations, important analytics, and decisive comparisons.
  - If I call “clear” or “slow,” adjust.
  - A speech document supports communication; it does not replace what you actually explain aloud.

- C. Cross-examination and conduct
  - Ask focused questions, answer directly, and allow reasonable opportunities to respond.
  - Use concessions in later speeches if you want them to become part of my decision.
  - Confidence and humor are welcome; intimidation and personal attacks are not.
  - Respect names, pronouns, accessibility needs, and differences in experience.
  - I will address serious harassment or discriminatory conduct through the applicable tournament procedures.

- D. Final speeches and technology
  - Collapse to a defensible path to victory instead of extending everything.
  - Distinguish legitimate explanation and responsive analysis from new independent offense.
  - Identify improper new arguments and explain the appropriate response.
  - Keep preparation, evidence exchange, and document sharing efficient and transparent.
  - Genuine connection or equipment failures are not speaker-point faults. Flag them promptly so the round can proceed fairly.

## IX. Speaker-Point Scale

- A. What speaker points measure
  - Speaker points assess individual performance, not merely whether your team won.
  - I consider clarity, organization, argument development, strategic judgment, responsiveness, evidence use, and respectful engagement.
  - Winning and speaking well overlap, but they are not identical; low-point wins are possible.
  - This proposed scale uses 28.5 as the baseline for a competent, solid performance.
  - Tournament instructions control if they require a different scale or restrict decimal scoring.

- B. Proposed 30-point rubric
  - 30.0 — Exceptional
    - An extraordinarily complete performance: precise, persuasive, efficient, strategically excellent, and consistently responsive.
    - Rare; not a reward for a joke, a particular argument, or simply winning decisively.
  - 29.5–29.9 — Outstanding
    - Excellent round vision, sophisticated comparisons, clear execution, and very few consequential weaknesses.
    - A performance deserving serious speaker-award consideration.
  - 29.0–29.4 — Very strong
    - Persuasive and well-organized, with strong engagement and strategic choices.
    - Minor omissions or inefficiencies do not substantially undermine the overall performance.
  - 28.5–28.9 — Solid to strong
    - Clear, competent debating with meaningful responses and a recognizable strategy.
    - Some comparisons, extensions, or explanations could be more complete.
  - 28.0–28.4 — Developing
    - Substantive participation, but noticeable problems with organization, warranting, clash, or prioritization.
    - The audience must do too much work to connect the arguments.
  - 27.0–27.9 — Significant improvement needed
    - Repeatedly incomplete arguments, major unanswered issues, or substantial communication and strategic problems.
    - This score identifies performance weaknesses; it does not itself allege misconduct.
  - Below 27.0 — Substantial performance or conduct concerns
    - Reserved for unusually serious breakdowns or significant misconduct, consistent with tournament guidance.
    - Any penalty for misconduct should have an identifiable basis, not simply reflect disagreement with an advocacy.

- C. How I apply the scale fairly
  - I reward good decisions relative to the opportunities available in the round.
  - Dominating a novice does not automatically earn outstanding points; accessible, respectful engagement can demonstrate stronger judgment.
  - I do not require a particular personality, eye-contact style, or physical presentation.
  - I do not penalize disability-related speech differences, requested accommodations, or genuine technical failures.
  `

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
    name: "Critical Judge",
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

/**
 * Looks up a built-in paradigm by its exact display `name` (e.g. a
 * `JudgeDecisionRecord.paradigmName`), or `null` if no built-in paradigm has
 * that name — including a custom paradigm's `"Custom: <judge name>"` label,
 * which never matches a built-in.
 */
export function getJudgeParadigmByName(name: string): JudgeParadigm | null {
  return listJudgeParadigms().find((paradigm) => paradigm.name === name) ?? null;
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
