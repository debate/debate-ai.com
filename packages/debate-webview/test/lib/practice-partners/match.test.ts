/**
 * @fileoverview Board ranking: shared formats first, empty lists read as
 * "any", and freshness breaks ties.
 */

import { describe, expect, it } from "vitest";

import { practiceMatch, rankVolunteers } from "../../../src/lib/practice-partners/match";
import type { PracticePreferences, PracticeVolunteer } from "../../../src/lib/practice-partners/types";

const me: PracticePreferences = {
  formats: ["pf", "ld"],
  styles: ["traditional", "critiques"],
  speed: "moderate",
  level: "jv",
  availability: "",
  note: "",
};

function volunteer(id: string, prefs: Partial<PracticePreferences>, updatedAt = 0): PracticeVolunteer {
  return {
    ...me,
    ...prefs,
    asCompetitor: true,
    asJudge: false,
    person: { id, name: id, imageUrl: null },
    updatedAt,
  };
}

describe("practiceMatch", () => {
  it("scores an identical profile as a great match", () => {
    expect(practiceMatch(me, me)).toMatchObject({ score: 100, label: "Great match", sharedFormats: ["pf", "ld"] });
  });

  it("gives no format credit to someone who shares no format", () => {
    const other = { ...me, formats: ["policy" as const] };
    const match = practiceMatch(me, other);
    expect(match.sharedFormats).toEqual([]);
    expect(match.score).toBe(60);
  });

  it("reads an empty format or style list as 'any', not 'none'", () => {
    const other = { ...me, formats: [], styles: [] };
    expect(practiceMatch(me, other).score).toBe(20 + 15 + 20 + 10);
  });

  it("gives half credit for a neighbouring speed and nothing two steps away", () => {
    expect(practiceMatch(me, { ...me, speed: "fast" }).score).toBe(90);
    expect(practiceMatch({ ...me, speed: "conversational" }, { ...me, speed: "fast" }).score).toBe(80);
  });

  it("does not rank anyone for a viewer with no profile", () => {
    expect(practiceMatch(null, me)).toMatchObject({ score: 0, label: null });
  });
});

describe("rankVolunteers", () => {
  it("puts the best match first and breaks ties by most recently updated", () => {
    const ranked = rankVolunteers(me, [
      volunteer("far", { formats: ["policy"], speed: "fast", level: "coach" }, 30),
      volunteer("old", {}, 10),
      volunteer("new", {}, 20),
    ]);
    expect(ranked.map(({ volunteer: v }) => v.person.id)).toEqual(["new", "old", "far"]);
  });
});
