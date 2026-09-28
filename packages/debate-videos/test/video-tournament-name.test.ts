/**
 * @fileoverview `cleanTournamentName` (`video-tree.ts`) is a second,
 * independent cleanup pass on a tournament's name — the label its group row
 * carries in the list layout's tree — distinct from
 * `stripTournamentYear` (`debate-data-sync/src/videos/video-rows.ts`), which
 * only drops a *leading* year before a tuple ever becomes a `VideoRow`. This
 * file feeds it values as they actually arrive here: already passed through
 * that upstream strip.
 */

import { describe, expect, it } from "vitest";
import { cleanTournamentName } from "../src/components/video-grid/video-tree";

describe("cleanTournamentName", () => {
  it("returns undefined for empty input", () => {
    expect(cleanTournamentName(null)).toBeUndefined();
    expect(cleanTournamentName(undefined)).toBeUndefined();
    expect(cleanTournamentName("")).toBeUndefined();
  });

  // Regression: "TOC21"/"Nats18"/"Nats16" are real `tournament` values in
  // `debate-data-sync/data/videos/rounds-pf.json`. The abbreviation+2-digit-year
  // regex used a non-capturing group with a `"$1"` replacement — since there
  // was no group 1, JS replaced the match with the literal text "$1" instead
  // of the intended abbreviation, so these rendered as "$1" in the video
  // table's Tournament column.
  it("strips a 2-digit year glued to TOC/Nats instead of leaving a literal '$1'", () => {
    expect(cleanTournamentName("TOC21")).toBe("TOC");
    expect(cleanTournamentName("TOC 2025")).toBe("TOC");
    // "Nats" alone is also one of the generic org words this function
    // strips outright (same as a bare "Nationals" or "Tournament"), so with
    // nothing else in the string there's nothing left to show.
    expect(cleanTournamentName("Nats18")).toBeUndefined();
    expect(cleanTournamentName("Nats16")).toBeUndefined();
  });

  it("expands full names to their abbreviation", () => {
    expect(cleanTournamentName("Tournament of Champions 2023")).toBe("TOC");
    expect(cleanTournamentName("National Debate Tournament")).toBe("NDT");
  });

  it("drops round-level and org-type words, keeping the tournament's own name", () => {
    expect(cleanTournamentName("Florida Blue Key 2024")).toBe("Florida Blue Key");
    expect(cleanTournamentName("Barkley Forum 2025")).toBe("Barkley Forum");
    expect(cleanTournamentName("NSDA Nationals")).toBe("NSDA");
    expect(cleanTournamentName("ACC Debate Tournament 2026")).toBe("ACC");
    expect(cleanTournamentName("Glenbrooks 2025 LD")).toBe("Glenbrooks LD");
  });

  it("leaves a name with no noise to strip untouched", () => {
    expect(cleanTournamentName("TOC")).toBe("TOC");
    expect(cleanTournamentName("Bronx")).toBe("Bronx");
    expect(cleanTournamentName("Harvard-Westlake RR")).toBe("Harvard-Westlake RR");
    expect(cleanTournamentName("Glenbrooks (RFD)")).toBe("Glenbrooks (RFD)");
  });
});
