import { describe, expect, it } from "vitest";

import { argumentCategory, argumentLabelPart, parseArgumentLabels } from "../src/lib/argument-labels";

describe("argumentLabelPart", () => {
  it("pulls the word NEW out into a flag", () => {
    expect(argumentLabelPart("NEW European Union")).toEqual({ name: "European Union", category: null, isNew: true });
    expect(argumentLabelPart("new aff")).toMatchObject({ name: "aff", isNew: true });
    expect(argumentLabelPart("Politics DA (new)")).toEqual({ name: "Politics", category: "DA", isNew: true });
  });

  it("leaves words that only contain 'new' alone", () => {
    expect(argumentLabelPart("Renewables")).toEqual({ name: "Renewables", category: null, isNew: false });
    expect(argumentLabelPart("New")).toEqual({ name: "New", category: null, isNew: false });
  });

  it("drops a K/CP/DA suffix the badge already shows", () => {
    expect(argumentLabelPart("Cap K")).toEqual({ name: "Cap", category: "K", isNew: false });
    expect(argumentLabelPart("Advantage CP")).toEqual({ name: "Advantage", category: "CP", isNew: false });
    expect(argumentLabelPart("K")).toEqual({ name: "K", category: "K", isNew: false });
  });
});

describe("argumentCategory", () => {
  it.each([
    ["T-Subsets", "T"],
    ["Topicality", "T"],
    ["States CP", "CP"],
    ["Consult NATO", "CP"],
    ["Setcol", "K"],
    ["Afropessimism", "K"],
    ["Elections", "DA"],
    ["Condo", "Theory"],
    ["Framework", "FW"],
    ["Heg", null],
    ["Tax credits", null],
  ])("%s → %s", (name, category) => {
    expect(argumentCategory(name)).toBe(category);
  });
});

describe("parseArgumentLabels", () => {
  it("splits on commas and skips blanks", () => {
    expect(parseArgumentLabels("NEW European Union, Cap K, ")).toEqual([
      { name: "European Union", category: null, isNew: true },
      { name: "Cap", category: "K", isNew: false },
    ]);
    expect(parseArgumentLabels(null)).toEqual([]);
  });
});
