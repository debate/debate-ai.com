/**
 * @fileoverview Configurable AI practice-opponent personas for idea
 * "AI Practice Opponent" in TODO.md ("Let debaters spar against an AI that
 * simulates common styles like policy heavy, kritik, lay, or fast-flowing
 * opponents."). Mirrors `../judge/judge-paradigms`'s structure: each persona
 * is an independently selectable, structured definition rather than a single
 * AI call rotating through styles. This is the first slice only — it doesn't
 * call any AI model itself; it's the persona-selection layer a future
 * speech-generation call (see idea #3's "Online Debate Versus AI" follow-ups
 * in TODO.md) could condition its prompt on.
 */

export type BuiltinOpponentPersonaId = "policy-heavy" | "kritik" | "lay" | "fast-flow";

export type OpponentPersonaPace = "slow" | "moderate" | "fast";

export type OpponentPersona = {
  id: BuiltinOpponentPersonaId;
  name: string;
  description: string;
  pace: OpponentPersonaPace;
  /** Argument types this persona reaches for first, highest priority first. */
  preferredArguments: string[];
  /** Imperative instructions meant to be injected into an AI speech-generation prompt. */
  instructions: string;
};

export const opponentPersonas: Record<BuiltinOpponentPersonaId, OpponentPersona> = {
  "policy-heavy": {
    id: "policy-heavy",
    name: "Policy Heavy",
    description:
      "A traditional policy debater who leans on counterplans, disadvantages, and net-benefit calculus rather than critical or theory arguments.",
    pace: "fast",
    preferredArguments: [
      "Counterplans with clear net benefits",
      "Disadvantages with a specific link story",
      "Solvency deficits against the plan",
      "Impact calculus (magnitude, probability, timeframe)",
    ],
    instructions:
      "Argue like a traditional policy debater. Favor counterplans and disadvantages with a specific link chain over critical or theory arguments, and frame every impact in terms of magnitude, probability, and timeframe. Speak at competitive tournament speed.",
  },
  kritik: {
    id: "kritik",
    name: "Kritik",
    description:
      "A critical debater who challenges the assumptions, representations, and framing of the opposing case before engaging its literal claims.",
    pace: "moderate",
    preferredArguments: [
      "Framework arguments over how the round should be evaluated",
      "Links to the opponent's representations, discourse, or methodology",
      "Alternative frameworks or praxis rather than a counterplan",
      "Case-specific critical links, only after framework is addressed",
    ],
    instructions:
      "Argue like a critical debater. Open by contesting the framework the round should be evaluated under and the assumptions or representations embedded in the opponent's case, rather than immediately engaging its literal claims. Prefer an alternative or praxis over a traditional counterplan.",
  },
  lay: {
    id: "lay",
    name: "Lay",
    description:
      "An accessible opponent who avoids jargon and speed, arguing in plain, persuasive language a non-debater could follow.",
    pace: "slow",
    preferredArguments: [
      "Clear, common-sense objections to the plan",
      "Real-world consequences over technical theory",
      "Persuasive framing over dense evidence citation",
    ],
    instructions:
      "Argue in plain, jargon-free language at a conversational pace. Avoid debate-specific theory and technical shorthand, and favor common-sense, persuasive objections over dense evidence citation.",
  },
  "fast-flow": {
    id: "fast-flow",
    name: "Fast Flow",
    description:
      "A high-speed technical opponent who spreads through many arguments per speech and punishes dropped or under-covered responses.",
    pace: "fast",
    preferredArguments: [
      "High argument volume — many independent responses per speech",
      "Extending anything the opponent under-covers or drops",
      "Technical theory and procedural arguments",
      "Efficient, blippy tagline-first structure",
    ],
    instructions:
      "Argue at maximum competitive speed, spreading through as many independent responses per speech as the format allows. Extend anything the opponent under-covers or drops, and don't hesitate to raise technical theory or procedural arguments alongside substance.",
  },
};

export const opponentPersonaIds = Object.keys(opponentPersonas) as BuiltinOpponentPersonaId[];

export function isBuiltinOpponentPersonaId(id: string): id is BuiltinOpponentPersonaId {
  return Object.prototype.hasOwnProperty.call(opponentPersonas, id);
}

/** Looks up a built-in opponent persona by id, or `null` if `id` isn't a known built-in. */
export function getOpponentPersona(id: string): OpponentPersona | null {
  return isBuiltinOpponentPersonaId(id) ? opponentPersonas[id] : null;
}

/** All built-in opponent personas, in a stable order — for a persona-picker UI. */
export function listOpponentPersonas(): OpponentPersona[] {
  return opponentPersonaIds.map((id) => opponentPersonas[id]);
}

/**
 * Composes a self-contained prompt section describing how the AI opponent
 * should argue under the given persona, suitable for inserting into a future
 * AI speech-generation prompt (see idea #3's `buildAiResponseRequest` in
 * `debate-round/src/round/ai-versus-speech-order.ts`).
 */
export function buildOpponentPersonaPrompt(persona: OpponentPersona): string {
  const lines = [`Opponent Persona: ${persona.name}`, persona.description];

  if (persona.preferredArguments.length > 0) {
    lines.push(
      "",
      "Preferred arguments (highest to lowest priority):",
      ...persona.preferredArguments.map((argument, index) => `${index + 1}. ${argument}`),
    );
  }

  lines.push("", `Pace: ${persona.pace}.`, "", persona.instructions);

  return lines.join("\n");
}
