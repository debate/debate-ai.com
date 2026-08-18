import { describe, expect, it } from "vitest";
import {
  DRILL_SCRIPT_AI_SYSTEM_PROMPT,
  buildDrillScriptAiUserPrompt,
  parseDrillScriptAiResponse,
  type DrillScriptAiInput,
} from "../src/round/drill-script-ai";
import type { Drill } from "../src/flow/drill-generator";

const FRONTLINE_DRILL: Drill = {
  kind: "frontline",
  rowIndex: 2,
  prompt: 'Write a frontline response to "Solvency deficit" (2AC) before it\'s extended again.',
};

const INPUT: DrillScriptAiInput = { sideKey: "AFF", drill: FRONTLINE_DRILL };

describe("DRILL_SCRIPT_AI_SYSTEM_PROMPT", () => {
  it("instructs the model to turn the template prompt into an actual script", () => {
    expect(DRILL_SCRIPT_AI_SYSTEM_PROMPT).toContain("actual, ready-to-read practice script");
  });

  it("instructs the model to reply with the script text only", () => {
    expect(DRILL_SCRIPT_AI_SYSTEM_PROMPT).toContain("script text ONLY");
  });

  it("instructs the model to stay grounded in the given prompt", () => {
    expect(DRILL_SCRIPT_AI_SYSTEM_PROMPT).toContain("don't invent new arguments");
  });
});

describe("buildDrillScriptAiUserPrompt", () => {
  it("includes the side being drilled", () => {
    expect(buildDrillScriptAiUserPrompt(INPUT)).toContain("Side: AFF");
  });

  it("includes the drill's kind label", () => {
    expect(buildDrillScriptAiUserPrompt(INPUT)).toContain("Drill kind: Frontline");
  });

  it("includes the drill's template prompt", () => {
    expect(buildDrillScriptAiUserPrompt(INPUT)).toContain("Solvency deficit");
  });

  it("labels each drill kind correctly", () => {
    const kinds: Array<[Drill["kind"], string]> = [
      ["overview", "Overview"],
      ["frontline", "Frontline"],
      ["cross_ex", "Cross-Ex"],
      ["collapse", "Collapse"],
    ];
    for (const [kind, label] of kinds) {
      const drill: Drill = { kind, rowIndex: null, prompt: "Prompt text." };
      expect(buildDrillScriptAiUserPrompt({ sideKey: "NEG", drill })).toContain(`Drill kind: ${label}`);
    }
  });
});

describe("parseDrillScriptAiResponse", () => {
  it("returns the trimmed script text", () => {
    expect(parseDrillScriptAiResponse("  I want to start by extending our solvency deficit...  ")).toBe(
      "I want to start by extending our solvency deficit...",
    );
  });

  it("strips a wrapping code fence with a language tag", () => {
    const raw = "```markdown\nI want to start by extending our solvency deficit...\n```";
    expect(parseDrillScriptAiResponse(raw)).toBe("I want to start by extending our solvency deficit...");
  });

  it("strips a wrapping code fence with no language tag", () => {
    const raw = "```\nI want to start by extending our solvency deficit...\n```";
    expect(parseDrillScriptAiResponse(raw)).toBe("I want to start by extending our solvency deficit...");
  });

  it("returns null for an empty string", () => {
    expect(parseDrillScriptAiResponse("")).toBeNull();
  });

  it("returns null for a blank string", () => {
    expect(parseDrillScriptAiResponse("   \n  ")).toBeNull();
  });

  it("returns null when a fence wraps nothing but whitespace", () => {
    expect(parseDrillScriptAiResponse("```\n  \n```")).toBeNull();
  });
});
