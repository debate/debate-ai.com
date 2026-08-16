import { describe, expect, it } from "vitest";
import type { Box } from "debate-core/src/types/flow";
import { buildCustomJudgeParadigm } from "debate-speech-writer/src/judge/judge-paradigms";
import {
  buildPracticeRoundFeedback,
  buildPracticeRoundFeedbackText,
  buildPracticeRoundSetup,
  buildPracticeRoundSetupText,
} from "../src/round/practice-round-simulator";

const STYLE_KEY = "lincolnDouglas";

describe("buildPracticeRoundSetup", () => {
  it("defaults to the primary side, the flow judge paradigm, and no opponent persona", () => {
    const setup = buildPracticeRoundSetup({ styleKey: STYLE_KEY });
    expect(setup.speechOrder[0].speaker).toBe("user");
    expect(setup.judgeParadigm.id).toBe("flow");
    expect(setup.opponentPersona).toBeNull();
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

  it("resolves a built-in opponent persona id", () => {
    const setup = buildPracticeRoundSetup({ styleKey: STYLE_KEY, opponentPersona: "kritik" });
    expect(setup.opponentPersona?.id).toBe("kritik");
    expect(setup.sections[2].body).toContain("Opponent Persona: Kritik");
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
