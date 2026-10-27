import { describe, expect, it } from "vitest";
import {
  buildCustomJudgeParadigm,
  buildJudgeParadigmPrompt,
  getJudgeParadigm,
  getJudgeParadigmByName,
  isBuiltinJudgeParadigmId,
  judgeParadigmIds,
  judgeParadigms,
  listJudgeParadigms,
  normalizeJudgeParadigmId,
  SPEAKER_POINTS_POLICY,
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

  it("offers exactly three judges: tech-over-truth policymaker, critique, then middle-ground flow", () => {
    expect(judgeParadigmIds).toEqual(["policymaker", "critic", "common-sense"]);
  });

  it("never promises points through auto-30 arguments, in every paradigm", () => {
    for (const paradigm of listJudgeParadigms()) {
      expect(paradigm.instructions).toContain(SPEAKER_POINTS_POLICY);
    }
  });

  it("listJudgeParadigms returns every registry entry in id order", () => {
    expect(listJudgeParadigms().map((p) => p.id)).toEqual(judgeParadigmIds);
  });
});

describe("isBuiltinJudgeParadigmId / getJudgeParadigm", () => {
  it("accepts known built-in ids", () => {
    expect(isBuiltinJudgeParadigmId("policymaker")).toBe(true);
    expect(getJudgeParadigm("policymaker")).toBe(judgeParadigms.policymaker);
  });

  it("maps retired ids to the nearest remaining paradigm", () => {
    expect(isBuiltinJudgeParadigmId("flow")).toBe(false);
    expect(normalizeJudgeParadigmId("flow")).toBe("policymaker");
    expect(getJudgeParadigm("flow")).toBe(judgeParadigms.policymaker);
    for (const id of ["lay", "educator", "truth-tester"]) {
      expect(getJudgeParadigm(id)).toBe(judgeParadigms["common-sense"]);
    }
    expect(normalizeJudgeParadigmId("made-up")).toBeNull();
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

describe("getJudgeParadigmByName", () => {
  it("resolves a built-in paradigm by its exact display name", () => {
    expect(getJudgeParadigmByName("Tech Over Truth Policymaker")).toBe(judgeParadigms.policymaker);
    expect(getJudgeParadigmByName("Critique (K) Judge")).toBe(judgeParadigms.critic);
  });

  it("resolves a retired paradigm's name to its replacement", () => {
    expect(getJudgeParadigmByName("Flow / Tech Judge")).toBe(judgeParadigms.policymaker);
    expect(getJudgeParadigmByName("Lay / Community Judge")).toBe(judgeParadigms["common-sense"]);
  });

  it("returns null for an unknown name, including a custom paradigm's label", () => {
    expect(getJudgeParadigmByName("made-up paradigm")).toBeNull();
    expect(getJudgeParadigmByName("Custom: Judge Smith")).toBeNull();
  });

  it("is case-sensitive, since it matches a stored display string exactly", () => {
    expect(getJudgeParadigmByName("flow / tech judge")).toBeNull();
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
    expect(paradigm.instructions).toContain(
      "Custom judge preferences:\nPrefers policy debate, dislikes speed, values clear signposting.",
    );
    expect(paradigm.votingPriorities[0]).toMatch(/panel sliders/);
  });

  it("trims whitespace and strips control characters from notes", () => {
    const paradigm = buildCustomJudgeParadigm({
      name: "  Judge Lee  ",
      notes: "  Line one\nLine two\x00\x07 has a bell.  ",
    });

    expect(paradigm.name).toBe("Custom: Judge Lee");
    expect(paradigm.instructions).toContain("Custom judge preferences:\nLine one\nLine two has a bell.\n");
    expect(paradigm.instructions).not.toMatch(/[\x00\x07]/);
  });

  it("clamps overly long notes to the maximum length", () => {
    const longNotes = "x".repeat(5000);
    const paradigm = buildCustomJudgeParadigm({ name: "Judge Long", notes: longNotes });
    expect(paradigm.instructions).toContain("x".repeat(2000));
    expect(paradigm.instructions).not.toContain("x".repeat(2001));
  });

  it("throws when name is empty after sanitization", () => {
    expect(() => buildCustomJudgeParadigm({ name: "   ", notes: "Some notes" })).toThrow(
      /name is required/,
    );
  });

  it("falls back to the main paradigm when notes are empty after sanitization", () => {
    const paradigm = buildCustomJudgeParadigm({ name: "Judge Smith", notes: "   " });
    expect(paradigm.instructions).not.toContain("Custom judge preferences");
    expect(paradigm.instructions).toContain("Panel weights (1-10)");
  });

  it("folds the panel weights into the instructions, defaulting unset ones", () => {
    const paradigm = buildCustomJudgeParadigm({ name: "Judge Smith", weights: { k: 9 } });
    expect(paradigm.instructions).toContain("Kritik (K)=9, Traditional=5, NatCircuit=5, Theory Heavy=5");
  });
});

describe("buildJudgeParadigmPrompt", () => {
  it("includes the paradigm name, priorities, tolerances, and instructions", () => {
    const prompt = buildJudgeParadigmPrompt(judgeParadigms.policymaker);

    expect(prompt).toContain("Judge Paradigm: Tech Over Truth Policymaker");
    expect(prompt).toContain("1. Dropped or conceded arguments");
    expect(prompt).toContain("Speed tolerance: high. Jargon tolerance: high.");
    expect(prompt).toContain(judgeParadigms.policymaker.instructions);
  });

  it("omits the voting-priorities section for a paradigm with none", () => {
    const custom = { ...buildCustomJudgeParadigm({ name: "Judge Kim", notes: "Values clash." }), votingPriorities: [] };
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
