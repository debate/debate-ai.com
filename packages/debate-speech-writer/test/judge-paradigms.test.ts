import { describe, expect, it } from "vitest";
import {
  buildCustomJudgeParadigm,
  buildJudgeParadigmPrompt,
  getJudgeParadigm,
  isBuiltinJudgeParadigmId,
  judgeParadigmIds,
  judgeParadigms,
  listJudgeParadigms,
} from "../src/judge/judge-paradigms";

describe("judgeParadigms registry", () => {
  it("keys every entry by its own id", () => {
    for (const [key, paradigm] of Object.entries(judgeParadigms)) {
      expect(paradigm.id).toBe(key);
    }
  });

  it("gives every built-in paradigm distinct, non-empty content", () => {
    const names = new Set<string>();
    for (const paradigm of Object.values(judgeParadigms)) {
      expect(paradigm.name.length).toBeGreaterThan(0);
      expect(paradigm.description.length).toBeGreaterThan(0);
      expect(paradigm.instructions.length).toBeGreaterThan(0);
      expect(paradigm.votingPriorities.length).toBeGreaterThan(0);
      names.add(paradigm.name);
    }
    expect(names.size).toBe(Object.keys(judgeParadigms).length);
  });

  it("includes the paradigms named in idea #5", () => {
    const ids = new Set(judgeParadigmIds);
    for (const id of ["flow", "lay", "policymaker", "critic", "educator", "truth-tester"]) {
      expect(ids.has(id as (typeof judgeParadigmIds)[number])).toBe(true);
    }
  });

  it("listJudgeParadigms returns every registry entry in id order", () => {
    expect(listJudgeParadigms().map((p) => p.id)).toEqual(judgeParadigmIds);
  });
});

describe("isBuiltinJudgeParadigmId / getJudgeParadigm", () => {
  it("accepts known built-in ids", () => {
    expect(isBuiltinJudgeParadigmId("flow")).toBe(true);
    expect(getJudgeParadigm("flow")).toBe(judgeParadigms.flow);
  });

  it("rejects unknown ids without throwing", () => {
    expect(isBuiltinJudgeParadigmId("made-up")).toBe(false);
    expect(getJudgeParadigm("made-up")).toBeNull();
  });

  it("rejects prototype-pollution-style lookups", () => {
    expect(isBuiltinJudgeParadigmId("toString")).toBe(false);
    expect(getJudgeParadigm("constructor")).toBeNull();
  });
});

describe("buildCustomJudgeParadigm", () => {
  it("builds a custom paradigm from a judge's stated preferences", () => {
    const paradigm = buildCustomJudgeParadigm({
      name: "Judge Smith",
      notes: "Prefers policy debate, dislikes speed, values clear signposting.",
    });

    expect(paradigm.id).toBe("custom");
    expect(paradigm.name).toContain("Judge Smith");
    expect(paradigm.instructions).toBe(
      "Prefers policy debate, dislikes speed, values clear signposting.",
    );
    expect(paradigm.votingPriorities).toEqual([]);
  });

  it("trims whitespace and strips control characters from notes", () => {
    const paradigm = buildCustomJudgeParadigm({
      name: "  Judge Lee  ",
      notes: "  Line one\nLine two\x00\x07 has a bell.  ",
    });

    expect(paradigm.name).toBe("Custom: Judge Lee");
    expect(paradigm.instructions).toBe("Line one\nLine two has a bell.");
  });

  it("clamps overly long notes to the maximum length", () => {
    const longNotes = "x".repeat(5000);
    const paradigm = buildCustomJudgeParadigm({ name: "Judge Long", notes: longNotes });
    expect(paradigm.instructions.length).toBeLessThanOrEqual(2000);
  });

  it("throws when name is empty after sanitization", () => {
    expect(() => buildCustomJudgeParadigm({ name: "   ", notes: "Some notes" })).toThrow(
      /name is required/,
    );
  });

  it("throws when notes are empty after sanitization", () => {
    expect(() => buildCustomJudgeParadigm({ name: "Judge Smith", notes: "   " })).toThrow(
      /notes are required/,
    );
  });
});

describe("buildJudgeParadigmPrompt", () => {
  it("includes the paradigm name, priorities, tolerances, and instructions", () => {
    const prompt = buildJudgeParadigmPrompt(judgeParadigms.flow);

    expect(prompt).toContain("Judge Paradigm: Flow / Tech Judge");
    expect(prompt).toContain("1. Dropped or conceded arguments");
    expect(prompt).toContain("Speed tolerance: high. Jargon tolerance: high.");
    expect(prompt).toContain(judgeParadigms.flow.instructions);
  });

  it("omits the voting-priorities section for a custom paradigm with none", () => {
    const custom = buildCustomJudgeParadigm({ name: "Judge Kim", notes: "Values clash." });
    const prompt = buildJudgeParadigmPrompt(custom);

    expect(prompt).not.toContain("Voting priorities");
    expect(prompt).toContain("Judge Paradigm: Custom: Judge Kim");
    expect(prompt).toContain("Values clash.");
  });

  it("produces a distinct prompt for every built-in paradigm", () => {
    const prompts = judgeParadigmIds.map((id) => buildJudgeParadigmPrompt(judgeParadigms[id]));
    expect(new Set(prompts).size).toBe(prompts.length);
  });
});
