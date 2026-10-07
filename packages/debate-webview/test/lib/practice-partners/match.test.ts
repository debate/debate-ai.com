/**
 * @fileoverview Board ranking: shared formats first, empty lists read as
 * "any", and freshness breaks ties.
 */

import { describe, expect, it } from "vitest";

import { MATCH_POOL_SIZE, pickPracticeMatch, practiceMatch, rankVolunteers } from "../../../src/lib/practice-partners/match";
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

describe("pickPracticeMatch", () => {
  it("returns null with nobody to pick", () => {
    expect(pickPracticeMatch(me, [])).toBeNull();
  });

  it("draws only from the most compatible few", () => {
    const poor = Array.from({ length: 10 }, (_, i) =>
      volunteer(`poor-${i}`, { formats: ["congress"], styles: [], speed: "conversational", level: "coach" }),
    );
    const good = Array.from({ length: MATCH_POOL_SIZE }, (_, i) => volunteer(`good-${i}`, {}));
    for (const roll of [0, 0.25, 0.5, 0.75, 0.999]) {
      const picked = pickPracticeMatch(me, [...poor, ...good], () => roll);
      expect(picked?.candidate.person.id).toMatch(/^good-/);
    }
  });

  it("varies with the random roll and reports the match it scored", () => {
    const candidates = [volunteer("a", {}), volunteer("b", {})];
    const first = pickPracticeMatch(me, candidates, () => 0);
    const last = pickPracticeMatch(me, candidates, () => 0.999);
    expect(first?.candidate.person.id).not.toBe(last?.candidate.person.id);
    expect(first?.match).toEqual(practiceMatch(me, candidates[0]!));
  });
});
