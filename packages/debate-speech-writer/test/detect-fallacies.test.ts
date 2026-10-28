import { describe, expect, it } from "vitest";
import { countFallaciesByKind, detectFallacies } from "../src/analysis/detect-fallacies";

describe("detectFallacies", () => {
  it("returns nothing for empty or non-string input", () => {
    expect(detectFallacies("")).toEqual([]);
    expect(detectFallacies("   ")).toEqual([]);
    expect(detectFallacies(undefined as unknown as string)).toEqual([]);
  });

  it("returns nothing for a neutral argument", () => {
    expect(
      detectFallacies("The study found a 12% drop in emissions, which supports our impact."),
    ).toEqual([]);
  });

  it("flags ad hominem attacks", () => {
    const [f] = detectFallacies("You are a liar, so ignore the card.");
    expect(f.kind).toBe("ad-hominem");
    expect(f.excerpt.toLowerCase()).toBe("you are a liar");
    expect(f.index).toBe(0);
    const [g] = detectFallacies("Coming from someone who lost last round, that is weak.");
    expect(g.kind).toBe("ad-hominem");
  });

  it("flags straw man restatements", () => {
    const found = detectFallacies("So you're basically saying we should abolish all police.");
    expect(found.map((x) => x.kind)).toEqual(["straw-man"]);
    expect(detectFallacies("What they really want is control.")[0].kind).toBe("straw-man");
  });

  it("flags false dichotomies", () => {
    const found = detectFallacies("Either we ban it entirely or the economy collapses.");
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe("false-dichotomy");
    expect(detectFallacies("There are only two options here.")[0].kind).toBe("false-dichotomy");
  });

  it("orders findings by position and honours the kinds filter", () => {
    const text = "Either we act or we fail. You are an idiot.";
    expect(detectFallacies(text).map((f) => f.kind)).toEqual(["false-dichotomy", "ad-hominem"]);
    expect(detectFallacies(text, ["ad-hominem"]).map((f) => f.kind)).toEqual(["ad-hominem"]);
  });

  it("does not report overlapping matches of one kind twice", () => {
    const found = detectFallacies("Either we pass it or we lose. There are only two options.");
    expect(found.filter((f) => f.kind === "false-dichotomy")).toHaveLength(2);
    const nested = detectFallacies("The only option is either this or that.");
    expect(nested.filter((f) => f.kind === "false-dichotomy").length).toBeGreaterThanOrEqual(1);
  });
});

describe("countFallaciesByKind", () => {
  it("zero-fills every kind and tallies findings", () => {
    expect(countFallaciesByKind([])).toEqual({
      "ad-hominem": 0,
      "straw-man": 0,
      "false-dichotomy": 0,
    });
    const counts = countFallaciesByKind(
      detectFallacies("Either we act or we fail. You are an idiot. They are fools."),
    );
    expect(counts).toEqual({ "ad-hominem": 2, "straw-man": 0, "false-dichotomy": 1 });
  });
});
