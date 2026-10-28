/**
 * @fileoverview The circuit calendar's weekends — week letters, the majors on
 * each weekend, and that the copy of the majors matches the calendar page.
 */

import { describe, expect, it } from "vitest";

import { DEBATE_MAJORS } from "@debate-ai/tournaments/majors";
import {
  SEASON_MAJORS,
  findSeasonWeekend,
  isSeasonWeekend,
  seasonWeekends,
  upcomingWeekends,
  weekendLabel,
  weekendRangeLabel,
} from "../../src/judge-pool/season-calendar";

describe("season weekends", () => {
  it("starts at week A (Sep 5, 2026) and letters weeks through Y (Feb 20, 2027)", () => {
    const weekends = seasonWeekends();
    expect(weekends[0]).toMatchObject({ key: "2026-09-05", sunday: "2026-09-06", week: "A" });
    expect(findSeasonWeekend("2027-02-20")?.week).toBe("Y");
    expect(findSeasonWeekend("2027-02-27")).toMatchObject({ week: "Z", championships: true });
    expect(weekends.at(-1)?.key).toBe("2027-06-19");
  });

  it("only uses Saturdays as keys", () => {
    for (const weekend of seasonWeekends()) {
      expect(new Date(`${weekend.key}T00:00:00Z`).getUTCDay()).toBe(6);
    }
    expect(isSeasonWeekend("2026-10-17")).toBe(true);
    expect(isSeasonWeekend("2026-10-18")).toBe(false);
    expect(isSeasonWeekend(42)).toBe(false);
  });

  it("puts the majors running Friday–Sunday on their weekend", () => {
    const names = findSeasonWeekend("2026-10-17")!.majors.map((event) => event.name);
    expect(names).toEqual(["Heart of Texas", "Big Bronx", "Minnesota College Invitational"]);
    // Florida Blue Key (Oct 29 – Nov 1) and Harvard College (Oct 31 – Nov 2).
    expect(findSeasonWeekend("2026-10-31")!.majors.map((event) => event.name)).toContain("Florida Blue Key");
    expect(findSeasonWeekend("2027-04-17")!.majors.map((event) => event.name)).toEqual(["TOC"]);
  });

  it("lists the weekends still ahead, keeping one whose Sunday is today", () => {
    expect(upcomingWeekends("2026-10-12")[0].key).toBe("2026-10-17");
    expect(upcomingWeekends("2026-10-18")[0].key).toBe("2026-10-17");
    expect(upcomingWeekends("2027-07-01")).toEqual([]);
  });

  it("labels weekends by week letter and dates", () => {
    expect(weekendRangeLabel("2026-10-17")).toBe("Oct 17–18");
    expect(weekendRangeLabel("2026-10-31")).toBe("Oct 31 – Nov 1");
    expect(weekendLabel("2026-10-17")).toBe("Week G · Oct 17–18");
  });

  it("carries every dated major on the circuit calendar page", () => {
    const dated = DEBATE_MAJORS.filter((event) => event.start)
      .map((event) => `${event.name}|${event.formats.join(" ")}|${event.start}|${event.end}`)
      .sort();
    const ours = SEASON_MAJORS.map(
      (event) => `${event.name}|${event.formats.join(" ")}|${event.start}|${event.end}`,
    ).sort();
    expect(ours).toEqual(dated);
  });
});
