// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { ProfileNdcaHistory } from "../src/leaderboard/profile/ProfileNdcaHistory";
import { mount, type Mounted } from "./helpers/mount";

describe("ProfileNdcaHistory", () => {
  let mounted: Mounted | null = null;
  afterEach(async () => {
    await mounted?.unmount();
    mounted = null;
  });

  it("lists a school's NDCA titles, elim seeds and speaker places by year", async () => {
    mounted = await mount(<ProfileNdcaHistory school="Glenbrook North High School (IL)" />);
    const text = mounted.container.textContent ?? "";
    expect(text).toContain("NDCA national championship (policy)");
    expect(text).toContain("1st seed");
    expect(text).toContain("Matt Fisher & Stephanie Spies");
    expect(text).toContain("5th speaker");
    expect(text).toContain("no 2010 record");
  });

  it("renders nothing for a school with no NDCA result", async () => {
    mounted = await mount(<ProfileNdcaHistory school="Nowhere High School" />);
    expect(mounted.container.textContent).toBe("");
  });
});
