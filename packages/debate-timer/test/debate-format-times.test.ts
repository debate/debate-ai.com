import { describe, expect, it } from "vitest";
import {
  debateStyleMap,
  debateStyleNames,
  debateStyles,
} from "../src/formats/debate-format-times";

describe("debate style registry", () => {
  it("defines a config for every style key", () => {
    for (const key of debateStyleMap) {
      expect(debateStyles[key], `missing config for ${key}`).toBeDefined();
    }
  });

  it("names every style", () => {
    expect(debateStyleNames).toHaveLength(debateStyleMap.length);
    expect(debateStyleNames.every((name) => name.trim().length > 0)).toBe(true);
  });

  it("aligns each display name with its style key by index", () => {
    const nameByKey: Record<(typeof debateStyleMap)[number], string> = {
      publicForum: "Public Forum",
      lincolnDouglas: "Lincoln Douglas",
      policy: "Policy",
      collegePolicy: "College Policy",
      collegeLD: "College LD",
      congress: "Congress",
      worldSchools: "World Schools",
      bigQuestions: "Big Questions",
      nofSpar: "NOF SPAR",
      parlimentary: "Parlimentary",
    };
    debateStyleMap.forEach((key, index) => {
      expect(debateStyleNames[index], key).toBe(nameByKey[key]);
    });
  });

  it("keeps style keys unique", () => {
    expect(new Set(debateStyleMap).size).toBe(debateStyleMap.length);
  });
});

describe("style configs", () => {
  it("gives every style a named primary side with columns", () => {
    for (const key of debateStyleMap) {
      const { primary } = debateStyles[key];
      expect(primary.name.length, key).toBeGreaterThan(0);
      expect(primary.columns.length, key).toBeGreaterThan(0);
    }
  });

  it("inverts the secondary side relative to the primary", () => {
    for (const key of debateStyleMap) {
      const style = debateStyles[key];
      if (!style.secondary) continue;
      expect(style.primary.invert, key).toBe(false);
      expect(style.secondary.invert, key).toBe(true);
    }
  });

  it("gives every timed speech a positive duration and a speaker", () => {
    for (const key of debateStyleMap) {
      for (const speech of debateStyles[key].timerSpeeches ?? []) {
        expect(speech.time, `${key} ${speech.name}`).toBeGreaterThan(0);
        expect(speech.name.length, key).toBeGreaterThan(0);
      }
    }
  });

  it("uses matching questioner/answerer roles on cross-ex speeches", () => {
    for (const key of debateStyleMap) {
      for (const speech of debateStyles[key].timerSpeeches ?? []) {
        if (!speech.cxRoles) continue;
        expect(speech.cxRoles.questioner, key).not.toBe(
          speech.cxRoles.answerer,
        );
      }
    }
  });
});

describe("policy format", () => {
  it("runs the eight standard constructive and rebuttal speeches", () => {
    expect(debateStyles.policy.primary.columns).toEqual([
      "1AC",
      "1NC",
      "2AC",
      "2NC",
      "1NR",
      "1AR",
      "2NR",
      "2AR",
    ]);
  });

  it("opens with an eight-minute 1AC", () => {
    const first = debateStyles.policy.timerSpeeches![0];
    expect(first.name).toBe("1AC");
    expect(first.time).toBe(8);
  });
});
