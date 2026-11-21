import { describe, expect, it } from "vitest";
import { identifySpeech } from "../src/lib/round-speeches";
import { standardRoundSpeeches } from "../src/lib/round-formats";

describe("PF speech names", () => {
  it("labels the crossfires CF1, CF2 and CF3", () => {
    expect(standardRoundSpeeches(2).map((speech) => speech.label)).toEqual([
      "C1", "C2", "CF1", "R1", "R2", "CF2", "S1", "S2", "CF3", "FF1", "FF2",
    ]);
  });

  it("reads a YouTube timestamp list's PF speech names", () => {
    const cases: Array<[string, string, string]> = [
      ["Aff Constructive (1AC)", "C1", "aff"],
      ["Neg Constructive (1NC)", "C2", "neg"],
      ["1st Cross 1CF", "Crossfire", "cx"],
      ["Aff Rebuttal (2AC)", "R1", "aff"],
      ["Neg Rebuttal (2NC)", "R2", "neg"],
      ["2nd Cross 2CF", "Crossfire", "cx"],
      ["Aff Summary (1AR)", "S1", "aff"],
      ["Neg Summary (1NR)", "S2", "neg"],
      ["Grand Cross 3CF", "Grand Crossfire", "cx"],
      ["Aff Final (2AR)", "FF1", "aff"],
      ["Neg Final (2NR)", "FF2", "neg"],
      ["CF3", "Grand Crossfire", "cx"],
    ];
    for (const [heading, label, side] of cases) {
      expect(identifySpeech(heading), heading).toMatchObject({ label, side, isSpeech: true });
    }
  });
});
