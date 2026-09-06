import { describe, expect, it } from "vitest";
import type { Box } from "../src/types/flow";
import { buildCustomJudgeParadigm } from "debate-speech-writer/src/judge/judge-paradigms";
import {
  buildCustomOpponentPersona,
  opponentPersonas,
} from "debate-speech-writer/src/opponent/opponent-personas";
import { buildAiVersusSpeechOrder } from "../src/round/ai-versus-speech-order";
import type { PriorSpeechRecord } from "../src/round/ai-versus-speech-order";
import {
  buildPracticeRoundFeedback,
  buildPracticeRoundFeedbackText,
  buildPracticeRoundReplaySteps,
  buildPracticeRoundSetup,
  buildPracticeRoundSetupText,
  resolvePracticeRoundOpponentPersonaChoice,
} from "../src/round/practice-round-simulator";

const STYLE_KEY = "lincolnDouglas";

describe("buildPracticeRoundSetup", () => {
  it("defaults to the primary side, the flow judge paradigm, no opponent persona, and intermediate difficulty", () => {
    const setup = buildPracticeRoundSetup({ styleKey: STYLE_KEY });
    expect(setup.speechOrder[0].speaker).toBe("user");
    expect(setup.judgeParadigm.id).toBe("flow");
    expect(setup.opponentPersona).toBeNull();
    expect(setup.opponentDifficulty).toBe("intermediate");
    expect(setup.sections.map((s) => s.title)).toEqual([
      "Speech order",
      "Judge paradigm",
      "AI opponent",
    ]);
    expect(setup.sections[2].body).toContain("No AI opponent persona selected");
  });

  it("flips the speech order when userSide is secondary", () => {
    const setup = buildPracticeRoundSetup({ styleKey: STYLE_KEY, userSide: "secondary" });
    expect(setup.speechOrder[0].speaker).toBe("ai");
  });

  it("resolves a built-in judge paradigm id", () => {
    const setup = buildPracticeRoundSetup({ styleKey: STYLE_KEY, judgeParadigm: "lay" });
    expect(setup.judgeParadigm.id).toBe("lay");
    expect(setup.sections[1].body).toContain("Lay / Community Judge");
  });

  it("accepts a pre-built (e.g. custom) judge paradigm object directly", () => {
    const custom = buildCustomJudgeParadigm({ name: "Judge Smith", notes: "Votes on framing." });
    const setup = buildPracticeRoundSetup({ styleKey: STYLE_KEY, judgeParadigm: custom });
    expect(setup.judgeParadigm.id).toBe("custom");
    expect(setup.sections[1].body).toContain("Votes on framing.");
  });

  it("throws for an unknown judge paradigm id", () => {
    expect(() =>
      buildPracticeRoundSetup({ styleKey: STYLE_KEY, judgeParadigm: "nonexistent" as never }),
    ).toThrow(/unknown judge paradigm id/);
  });

  it("resolves a built-in opponent persona id, layering the default (intermediate) difficulty", () => {
    const setup = buildPracticeRoundSetup({ styleKey: STYLE_KEY, opponentPersona: "kritik" });
    expect(setup.opponentPersona?.id).toBe("kritik");
    expect(setup.opponentDifficulty).toBe("intermediate");
    expect(setup.sections[2].body).toContain("Opponent Persona: Kritik");
    expect(setup.sections[2].body).toContain("Difficulty: Intermediate.");
  });

  it("layers an explicit opponent difficulty onto the persona's own prompt section", () => {
    const setup = buildPracticeRoundSetup({
      styleKey: STYLE_KEY,
      opponentPersona: "kritik",
      opponentDifficulty: "elite",
    });
    expect(setup.opponentDifficulty).toBe("elite");
    expect(setup.sections[2].body).toContain("Difficulty: Elite.");
  });

  it("accepts a pre-built opponent persona object directly", () => {
    const setup = buildPracticeRoundSetup({
      styleKey: STYLE_KEY,
      opponentPersona: {
        id: "lay",
        name: "Custom Lay",
        description: "A custom-labeled lay opponent.",
        pace: "slow",
        preferredArguments: [],
        instructions: "Argue plainly.",
      },
    });
    expect(setup.opponentPersona?.name).toBe("Custom Lay");
  });

  it("throws for an unknown opponent persona id", () => {
    expect(() =>
      buildPracticeRoundSetup({ styleKey: STYLE_KEY, opponentPersona: "nonexistent" as never }),
    ).toThrow(/unknown opponent persona id/);
  });

  it("numbers the speech order section by delivery position, tagging speaker and time", () => {
    const setup = buildPracticeRoundSetup({ styleKey: STYLE_KEY });
    expect(setup.sections[0].body.split("\n")[0]).toBe("1. AC (you, 6s)");
  });
});

describe("resolvePracticeRoundOpponentPersonaChoice", () => {
  it("resolves 'none' to undefined", () => {
    expect(resolvePracticeRoundOpponentPersonaChoice({ kind: "none" })).toBeUndefined();
  });

  it("resolves a built-in choice to its id, unresolved", () => {
    expect(resolvePracticeRoundOpponentPersonaChoice({ kind: "builtin", id: "kritik" })).toBe("kritik");
  });

  it("resolves a custom choice into a built OpponentPersona, usable directly by buildPracticeRoundSetup", () => {
    const persona = resolvePracticeRoundOpponentPersonaChoice({
      kind: "custom",
      name: "Speedster",
      notes: "Spreads everything.",
    });
    expect(persona).not.toBeUndefined();
    expect(persona).not.toBe("kritik");
    const setup = buildPracticeRoundSetup({ styleKey: STYLE_KEY, opponentPersona: persona });
    expect(setup.opponentPersona?.name).toBe("Custom: Speedster");
  });

  it("throws for a custom choice with an empty name, mirroring buildCustomOpponentPersona", () => {
    expect(() =>
      resolvePracticeRoundOpponentPersonaChoice({ kind: "custom", name: "   ", notes: "Spreads everything." }),
    ).toThrow(/name is required/);
  });

  it("throws for a custom choice with empty notes, mirroring buildCustomOpponentPersona", () => {
    expect(() =>
      resolvePracticeRoundOpponentPersonaChoice({ kind: "custom", name: "Speedster", notes: "   " }),
    ).toThrow(/notes are required/);
  });
});

describe("buildPracticeRoundSetupText", () => {
  it("renders every section under a markdown-ish heading", () => {
    const setup = buildPracticeRoundSetup({ styleKey: STYLE_KEY });
    const text = buildPracticeRoundSetupText(setup);
    expect(text).toContain("### Speech order");
    expect(text).toContain("### Judge paradigm");
    expect(text).toContain("### AI opponent");
  });
});

const COLUMNS = ["1AC", "1NC", "2AC", "2NC"];

/** Builds a row's box chain from per-column content; "" leaves a column unflowed. */
function rowFromContents(contents: string[]): Box {
  let box: Box | undefined;
  for (let i = contents.length - 1; i >= 0; i--) {
    const current: Box = {
      content: contents[i],
      children: box ? [box] : [],
      index: 0,
      level: i + 1,
      focus: false,
      empty: !contents[i].trim(),
    };
    box = current;
  }
  return box as Box;
}

// Row 0: "Case advantage" (A side) — dropped after 1NC, unanswered since 1NC (N side).
const FLOW = {
  columns: COLUMNS,
  children: [rowFromContents(["Case advantage", "Turn", "", ""])],
};

describe("buildPracticeRoundFeedback", () => {
  it("frames feedback around the judge paradigm's voting priorities when present", () => {
    const feedback = buildPracticeRoundFeedback(FLOW, "A", {
      id: "flow",
      name: "Flow / Tech Judge",
      description: "desc",
      votingPriorities: ["Dropped arguments", "Impact calculus"],
      speedTolerance: "high",
      jargonTolerance: "high",
      instructions: "instructions",
    });
    expect(feedback.sections[0].title).toBe("Judged under: Flow / Tech Judge");
    expect(feedback.sections[0].body).toBe(
      "Voting priorities: Dropped arguments; Impact calculus.",
    );
  });

  it("falls back to the paradigm's description when it has no voting priorities (e.g. custom)", () => {
    const custom = buildCustomJudgeParadigm({ name: "Judge Smith", notes: "Votes on framing." });
    const feedback = buildPracticeRoundFeedback(FLOW, "A", custom);
    expect(feedback.sections[0].body).toBe(custom.description);
  });

  it("includes the AI Coach Mode coaching session for the given side", () => {
    const custom = buildCustomJudgeParadigm({ name: "Judge Smith", notes: "Votes on framing." });
    const feedback = buildPracticeRoundFeedback(FLOW, "A", custom);
    expect(feedback.coachingPrompts.length).toBeGreaterThan(0);
    expect(feedback.sections[1].title).toBe("Coaching feedback");
    expect(feedback.sections[1].body).toContain("Case advantage");
  });

  it("passes through a collapseLimit option to the coaching session", () => {
    const custom = buildCustomJudgeParadigm({ name: "Judge Smith", notes: "Votes on framing." });
    const feedback = buildPracticeRoundFeedback(FLOW, "A", custom, { collapseLimit: 0 });
    expect(feedback.coachingPrompts.some((p) => p.kind === "collapse")).toBe(false);
  });

  it("omits the persona-tips section when no opponentPersona option is given", () => {
    const custom = buildCustomJudgeParadigm({ name: "Judge Smith", notes: "Votes on framing." });
    const feedback = buildPracticeRoundFeedback(FLOW, "A", custom);
    expect(feedback.sections).toHaveLength(2);
  });

  it("omits the persona-tips section when opponentPersona is explicitly null", () => {
    const custom = buildCustomJudgeParadigm({ name: "Judge Smith", notes: "Votes on framing." });
    const feedback = buildPracticeRoundFeedback(FLOW, "A", custom, { opponentPersona: null });
    expect(feedback.sections).toHaveLength(2);
  });

  it("adds a persona-specific prep-tips section when opponentPersona is given", () => {
    const custom = buildCustomJudgeParadigm({ name: "Judge Smith", notes: "Votes on framing." });
    const feedback = buildPracticeRoundFeedback(FLOW, "A", custom, {
      opponentPersona: opponentPersonas.kritik,
    });

    expect(feedback.sections).toHaveLength(3);
    expect(feedback.sections[2].title).toBe("Facing the Kritik persona again");
    expect(feedback.sections[2].body).toContain("1. Pre-write a framework defense");
  });

  it("still passes collapseLimit through to the coaching session when opponentPersona is also given", () => {
    const custom = buildCustomJudgeParadigm({ name: "Judge Smith", notes: "Votes on framing." });
    const feedback = buildPracticeRoundFeedback(FLOW, "A", custom, {
      collapseLimit: 0,
      opponentPersona: opponentPersonas.kritik,
    });
    expect(feedback.coachingPrompts.some((p) => p.kind === "collapse")).toBe(false);
    expect(feedback.sections).toHaveLength(3);
  });

  it("uses the generic tip for a custom opponent persona", () => {
    const custom = buildCustomJudgeParadigm({ name: "Judge Smith", notes: "Votes on framing." });
    const customPersona = buildCustomOpponentPersona({
      name: "Speedster",
      notes: "Spreads everything.",
    });
    const feedback = buildPracticeRoundFeedback(FLOW, "A", custom, { opponentPersona: customPersona });

    expect(feedback.sections[2].title).toBe("Facing the Custom: Speedster persona again");
    expect(feedback.sections[2].body).toContain("Re-read this custom opponent's described style notes");
  });
});

describe("buildPracticeRoundFeedbackText", () => {
  it("renders every section under a markdown-ish heading", () => {
    const custom = buildCustomJudgeParadigm({ name: "Judge Smith", notes: "Votes on framing." });
    const feedback = buildPracticeRoundFeedback(FLOW, "A", custom);
    const text = buildPracticeRoundFeedbackText(feedback);
    expect(text).toContain("### Judged under: Custom: Judge Smith");
    expect(text).toContain("### Coaching feedback");
  });
});

describe("buildPracticeRoundReplaySteps", () => {
  const order = buildAiVersusSpeechOrder(STYLE_KEY);

  it("marks every step undelivered when no speeches have been submitted yet", () => {
    const steps = buildPracticeRoundReplaySteps(order, []);
    expect(steps).toHaveLength(order.length);
    expect(steps.every((step) => !step.delivered && step.text === null)).toBe(true);
  });

  it("carries each slot's index/name/speaker/secondary/time through unchanged", () => {
    const steps = buildPracticeRoundReplaySteps(order, []);
    steps.forEach((step, i) => {
      expect(step.index).toBe(order[i].index);
      expect(step.name).toBe(order[i].name);
      expect(step.speaker).toBe(order[i].speaker);
      expect(step.secondary).toBe(order[i].secondary);
      expect(step.time).toBe(order[i].time);
    });
  });

  it("marks a prefix of steps delivered, matching submittedSpeeches positionally", () => {
    const submitted: PriorSpeechRecord[] = [
      { name: order[0].name, speaker: order[0].speaker, text: "First speech text." },
      { name: order[1].name, speaker: order[1].speaker, text: "Second speech text." },
    ];
    const steps = buildPracticeRoundReplaySteps(order, submitted);

    expect(steps[0].delivered).toBe(true);
    expect(steps[0].text).toBe("First speech text.");
    expect(steps[1].delivered).toBe(true);
    expect(steps[1].text).toBe("Second speech text.");
    expect(steps[2].delivered).toBe(false);
    expect(steps[2].text).toBeNull();
  });

  it("marks every step delivered once every speech has been submitted", () => {
    const submitted: PriorSpeechRecord[] = order.map((slot) => ({
      name: slot.name,
      speaker: slot.speaker,
      text: `Text for ${slot.name}`,
    }));
    const steps = buildPracticeRoundReplaySteps(order, submitted);
    expect(steps.every((step) => step.delivered)).toBe(true);
    expect(steps.map((step) => step.text)).toEqual(order.map((slot) => `Text for ${slot.name}`));
  });

  it("returns an empty sequence for an empty speech order", () => {
    expect(buildPracticeRoundReplaySteps([], [])).toEqual([]);
  });
});
