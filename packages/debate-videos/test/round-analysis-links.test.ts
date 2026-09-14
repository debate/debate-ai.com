import { describe, expect, it } from "vitest";
import { ROUND_ANALYSIS_LINKS, linkedRoundVideoId } from "../src/lib/round-analysis-links";

describe("round analysis links", () => {
  it("links each seeded infographic to its full round in both directions", () => {
    expect(ROUND_ANALYSIS_LINKS).toMatchObject({
      "DfG4qeHIU9M": "T77G1CdZx9E",
      "Afl7_hl-H0c": "qx7Xx_6exzk",
      "rXAfSFKvMJY": "zoKowWVQ1wE",
    });
    expect(linkedRoundVideoId("zoKowWVQ1wE")).toBe("rXAfSFKvMJY");
    expect(linkedRoundVideoId("unlinked-video")).toBeUndefined();
  });
});
