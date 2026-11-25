// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { PastHighSchoolTeamView } from "../src/leaderboard/profile/PastHighSchoolTeamProfile";
import { schoolNationals } from "../src/leaderboard/profile/nationalsHistory";
import { mount, type Mounted } from "./helpers/mount";

describe("PastHighSchoolTeamView", () => {
  let mounted: Mounted | null = null;
  afterEach(async () => {
    await mounted?.unmount();
    mounted = null;
  });

  it("shows a nationals-only team's finishes without an empty seasons table", async () => {
    const rows = schoolNationals("St. Mark's School of Texas (TX)").rows.filter((r) => r.competitors.includes("Steven Sklaver"));
    mounted = await mount(
      <PastHighSchoolTeamView
        team={{ schoolKey: "st-mark-s-school-of-texas-tx", name: rows[0].competitors, seasons: [], nationals: rows }}
        datasets={[]}
      />,
    );
    const text = mounted.container.textContent ?? "";
    expect(text).toContain("National finishes");
    expect(text).toContain("1989");
    expect(text).not.toContain("Past seasons");
  });
});
