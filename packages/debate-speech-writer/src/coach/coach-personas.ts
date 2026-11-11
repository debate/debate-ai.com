/**
 * @fileoverview Configurable AI coaching personas — the IDEAS.md bonus idea
 * "Debate Coaching AI Persona": "Configurable AI personas (Socratic, Devil's
 * Advocate, Fact-Checker) for practice sessions."
 *
 * Mirrors `../opponent/opponent-personas.ts` and `../judge/judge-paradigms.ts`:
 * each persona is a structured, independently selectable definition whose
 * `instructions` are appended to a coaching call's system prompt. This module
 * makes no AI call itself. Its first consumer is `debate-practice-rounds`'
 * `round/coach-feedback-ai.ts` (AI Coach Mode's **Get AI feedback**).
 *
 * Every persona keeps the coaching guardrail: critique the argument, never
 * the debater. Coaching feedback goes to students, often minors.
 *
 * @module coach/coach-personas
 */

export type CoachPersonaId = "standard" | "socratic" | "devils-advocate" | "fact-checker";

export type CoachPersona = {
  id: CoachPersonaId;
  /** Short label for a picker, e.g. "Socratic". */
  name: string;
  /** One-sentence description of how this coach gives feedback. */
  description: string;
  /**
   * Imperative instructions appended to the coaching system prompt. Empty for
   * `standard`, which keeps the base prompt unchanged.
   */
  instructions: string;
};

/** The persona used when none is chosen; it leaves the base prompt as is. */
export const DEFAULT_COACH_PERSONA_ID: CoachPersonaId = "standard";

const SHARED_GUARDRAIL =
  "Whatever the style, critique the arguments and choices, never the debater as a person, and keep the tone encouraging.";

export const coachPersonas: Record<CoachPersonaId, CoachPersona> = {
  standard: {
    id: "standard",
    name: "Standard",
    description: "A direct debrief: what to prioritise next time and why.",
    instructions: "",
  },
  socratic: {
    id: "socratic",
    name: "Socratic",
    description: "Leads with questions so you work out the fix yourself.",
    instructions:
      "Coach in a Socratic style. For each priority, ask one or two pointed questions that lead the " +
      "debater to the answer (for example \"What does your opponent have to win if you drop this?\") " +
      "before giving a short hint. Prefer questions over instructions, and end with the single most " +
      "important question to think about before the next round. " +
      SHARED_GUARDRAIL,
  },
  "devils-advocate": {
    id: "devils-advocate",
    name: "Devil's Advocate",
    description: "Argues the other side to stress-test your strategy.",
    instructions:
      "Coach as a devil's advocate. For each priority, argue the strongest response the other side " +
      "could make to that strategy, then explain how the debater should pre-empt or answer it. Be " +
      "rigorous but fair: steelman the opposing view rather than inventing weak objections, and stay " +
      "grounded in the prompts you were given. " +
      SHARED_GUARDRAIL,
  },
  "fact-checker": {
    id: "fact-checker",
    name: "Fact-Checker",
    description: "Flags claims that need evidence and what kind would back them.",
    instructions:
      "Coach as a fact-checker. For each priority, point out which claims would need evidence to hold " +
      "up in front of a judge, say what kind of source or card would support them (for example a " +
      "recent empirical study or an expert with direct authority), and flag any warrant that looks " +
      "asserted rather than proven. Do not state new facts or statistics yourself; say what to look " +
      "for instead. " +
      SHARED_GUARDRAIL,
  },
};

const ORDER: CoachPersonaId[] = ["standard", "socratic", "devils-advocate", "fact-checker"];

/** Every coaching persona in a stable order, for a persona picker. */
export function listCoachPersonas(): CoachPersona[] {
  return ORDER.map((id) => coachPersonas[id]);
}

/** Narrows an unknown value (e.g. a stored field) to a `CoachPersonaId`. */
export function isCoachPersonaId(value: unknown): value is CoachPersonaId {
  return typeof value === "string" && (ORDER as string[]).includes(value);
}

/**
 * Resolves an unknown value to a persona, falling back to the default for
 * anything missing or unrecognised (e.g. a record saved before personas).
 */
export function resolveCoachPersona(value: unknown): CoachPersona {
  return coachPersonas[isCoachPersonaId(value) ? value : DEFAULT_COACH_PERSONA_ID];
}

/**
 * Appends a persona's instructions to `basePrompt` as a labelled section.
 * Returns `basePrompt` unchanged for the standard persona or an unknown id.
 */
export function applyCoachPersonaToSystemPrompt(basePrompt: string, personaId: unknown): string {
  const persona = resolveCoachPersona(personaId);
  if (!persona.instructions) return basePrompt;
  return `${basePrompt}\n\nCoaching style — ${persona.name}:\n${persona.instructions}`;
}
