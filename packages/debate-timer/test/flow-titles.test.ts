/**
 * @fileoverview Covers the round title and slug generators. Both are what a
 * debater sees on a saved round and in its shareable URL, so the fallbacks for
 * a round created before its teams are filled in matter as much as the happy path.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  generateRoundSlug,
  generateRoundTitle,
  type Round,
} from "../src/types/flow";

/** `schools` is a fixed two-entry tuple per side: the school and its team code. */
const ROUND: Pick<Round, "tournamentName" | "roundLevel" | "schools"> = {
  tournamentName: "Glenbrooks",
  roundLevel: "Octos",
  schools: { aff: ["Lynbrook BZ", ""], neg: ["Monta Vista EY", ""] },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-11-22T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("generateRoundTitle", () => {
  it("reads year, tournament, level and both teams", () => {
    expect(generateRoundTitle(ROUND)).toBe(
      "2025 Glenbrooks - Octos - Lynbrook BZ vs Monta Vista EY",
    );
  });

  it("names the sides generically when no schools are set", () => {
    expect(
      generateRoundTitle({ ...ROUND, schools: undefined }),
    ).toBe("2025 Glenbrooks - Octos - Team Aff vs Team Neg");
  });

  it("names a side generically when only that side is empty", () => {
    expect(
      generateRoundTitle({
        ...ROUND,
        schools: { aff: ["", ""], neg: ["Monta Vista EY", ""] },
      }),
    ).toContain("Team Aff vs Monta Vista EY");
  });

  it("uses the first entry when a side lists several schools", () => {
    expect(
      generateRoundTitle({
        ...ROUND,
        schools: { aff: ["Lynbrook BZ", "Lynbrook CD"], neg: ["Monta Vista EY", ""] },
      }),
    ).toContain("Lynbrook BZ vs");
  });
});

describe("generateRoundSlug", () => {
  it("builds a year/tournament path with both teams", () => {
    expect(generateRoundSlug(ROUND)).toBe(
      "2025-glenbrooks/lynbrook-bz-monta-vista-ey",
    );
  });

  it("collapses punctuation and spaces into single hyphens", () => {
    expect(
      generateRoundSlug({
        tournamentName: "Tournament of Champions!!",
        schools: { aff: ["St. Mark's  A", ""], neg: ["Team B", ""] },
      }),
    ).toBe("2025-tournament-of-champions/st-mark-s-a-team-b");
  });

  it("never leaves a leading or trailing hyphen on a segment", () => {
    const slug = generateRoundSlug({
      tournamentName: "  --Berkeley--  ",
      schools: { aff: ["-Aff-", ""], neg: ["-Neg-", ""] },
    });
    for (const segment of slug.split("/")) {
      expect(segment.startsWith("-")).toBe(false);
      expect(segment.endsWith("-")).toBe(false);
    }
  });

  it("falls back to generic team slugs when no schools are set", () => {
    expect(generateRoundSlug({ ...ROUND, schools: undefined })).toBe(
      "2025-glenbrooks/team-aff-team-neg",
    );
  });

  it("stays url-safe for any input", () => {
    const slug = generateRoundSlug({
      tournamentName: "Cal/Berkeley 2025 — Round #1",
      schools: { aff: ["Ünïcode Prep", ""], neg: ["Team & Co.", ""] },
    });
    expect(slug).toMatch(/^[a-z0-9-]+\/[a-z0-9-]+$/);
  });
});
